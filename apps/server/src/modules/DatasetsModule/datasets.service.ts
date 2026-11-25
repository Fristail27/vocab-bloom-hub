import { forkDataset } from './fork-dataset';
import { normalizeStoredWordOrigins } from '../../db/normalize-word-origins';
import type { ForkProgressT } from '../../../types';
import { defaultOrigins } from '../../../core/utils/provenance';
import { assertOriginsEdit, assertCompatibleOrigins } from '../../core/utils/provenance';
import { EnWord } from '../EnModule/entities/en_word.entity';
import { EnChange } from '../EnModule/entities/en_change.entity';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, IsNull } from 'typeorm';
import { checkIsPostgres } from '../../../configuration';
import {
  ACTIVE_DATASET_SETTINGS_FIELD,
  DATASET_NAME_PATTERN,
  DATASET_REMOVED_AT_SETTINGS_FIELD,
  DEFAULT_DATASET_NAME,
} from '../../../core/constants/datasets';
import {
  catalogTerms,
  DATASET_CATALOG,
  DatasetCatalogEntryT,
  findCatalogEntry,
  isReservedDatasetName,
} from '../../../core/constants/dataset_catalog';
import { findStandardLicense } from '../../../core/constants/data_licenses';
import { ErrorCodes } from '../../../core/constants/error_codes';
import {
  AuditActionE,
  AuditDiffT,
  AuditEntityTypeE,
  CreateDatasetReqT,
  DatasetLicenseReqT,
  DatasetProvenanceT,
  DatasetT,
  DatasetsListT,
  UpdateDatasetReqT,
} from '../../../types';
import { setActiveDataset, requestDefault } from '../../core/utils/active-dataset';
import { withDatasetScope } from '../../core/utils/dataset-scope';
import { dictionaryConnection } from '../../db/shared-dictionary/connection';
import { AuditService } from '../AuditModule/audit.service';
import { DATASET_VERSION_SETTINGS_FIELD } from '../EnModule/modules/EnImportDictionary/constants';
import { ImportStatusService } from '../EnModule/modules/EnImportDictionary/importStatus.service';
import { Settings } from '../SettingsModule/entities/settings.entity';
import { Dataset } from './entities/dataset.entity';
import { SwitchGate } from './switch-gate';

type RegistryTermsT = DatasetProvenanceT & { title: string | null; license_text: string | null };

/** The terms of a catalog entry as the registry keeps them: what the source does not ask for is a null */
const registryTerms = (entry: DatasetCatalogEntryT): RegistryTermsT => {
  const terms = catalogTerms(entry);
  return {
    ...terms,
    title: entry.title,
    attribution_url: terms.attribution_url || null,
    notice: terms.notice || null,
    // the notices of a source are the catalog's, read from it
    license_text: null,
  };
};

const TERMS_FIELDS = [
  'source',
  'language',
  'title',
  'license',
  'license_url',
  'attribution',
  'attribution_url',
  'notice',
  'license_text',
] as const satisfies ReadonlyArray<keyof RegistryTermsT>;

/** A dataset of the instance's own (issue #540): created by the admin, marked so in the registry */
export const isOwnDataset = (dataset: { own?: boolean }): boolean => dataset.own === true;

type LicenseTermsT = Pick<Dataset, 'license' | 'license_url' | 'license_text'>;

/**
 * The license a request names, as the registry keeps it: one of the list by
 * its identifier, or the name, the link and the text of a license of the
 * owner's own — never a mix, never a name the list uses for another license
 */
const licenseTermsOf = (license: DatasetLicenseReqT): LicenseTermsT => {
  const custom = [license.name, license.url, license.text].map((value) => value?.trim() ?? '');
  if (license.spdx !== undefined) {
    const standard = findStandardLicense(license.spdx);
    if (!standard || custom.some(Boolean)) throw new BadRequestException(ErrorCodes.dataset_license_invalid);
    return { license: standard.spdx, license_url: standard.url, license_text: null };
  }
  const [name, url, text] = custom as [string, string, string];
  if (!name || !url || !text || findStandardLicense(name)) {
    throw new BadRequestException(ErrorCodes.dataset_license_invalid);
  }
  return { license: name, license_url: url, license_text: text };
};

// the audit journal keeps what a license was changed from and to, not a
// copy of every text: the beginning of it tells the two apart
const AUDIT_TEXT_LENGTH = 200;
const forAudit = (value: string | null): string | null =>
  value && value.length > AUDIT_TEXT_LENGTH ? `${value.slice(0, AUDIT_TEXT_LENGTH)}…` : value;

/** The terms of the project's own dataset, what `default` is registered with */
export const OWN_DATASET_PROVENANCE: DatasetProvenanceT = registryTerms(
  findCatalogEntry(DEFAULT_DATASET_NAME) as DatasetCatalogEntryT,
);

/** The name of a dataset for a reader: the owner's title, the catalog's, the bare name of a dataset from before titles */
export const titleOf = (dataset: Pick<Dataset, 'name' | 'title'> & { own?: boolean }): string =>
  dataset.title || (dataset.own ? undefined : findCatalogEntry(dataset.name)?.title) || dataset.name;

/** The entry of the catalog behind a dataset; none for a dataset of the owner's, whatever its name */
export const catalogEntryOf = (dataset: { name: string; own?: boolean }): DatasetCatalogEntryT | undefined =>
  dataset.own ? undefined : findCatalogEntry(dataset.name);

type ActiveListenerT = (dataset: Dataset) => void;
type RegistryListenerT = () => void;

/** A way into a dataset's tables: the application's own connection for the active one, one of its own otherwise */
export type DatasetConnectionT = { dataset: Dataset; manager: EntityManager; close: () => Promise<void> };

/** All dictionaries use one pool. Creating or selecting a dataset changes registry data. */
@Injectable()
export class DatasetsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatasetsService.name);

  /** Whether the installation supports multiple dictionaries */
  readonly supported = checkIsPostgres();

  @Optional()
  @Inject(AuditService)
  private readonly auditService?: AuditService;

  /** Reconciliation publication waits for active readers to drain. */
  readonly gate = new SwitchGate();

  private current!: Dataset;
  private busy = false;
  private readonly forks = new Map<string, ForkProgressT>();
  private forkWork?: Promise<void>;

  // the active dataset; every change of it reaches the process-wide reference
  // the journal and the projections read
  private get active(): Dataset {
    return this.current;
  }

  private set active(dataset: Dataset) {
    this.current = dataset;
    setActiveDataset(dataset);
  }
  private readonly listeners: ActiveListenerT[] = [];
  private readonly registryListeners: RegistryListenerT[] = [];

  constructor(
    @InjectRepository(Dataset) private readonly datasetsRep: Repository<Dataset>,
    @InjectRepository(Settings) private readonly settingsRep: Repository<Settings>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() private readonly importStatus?: ImportStatusService,
  ) {}

  async onModuleInit(): Promise<void> {
    // SQLite synchronizes columns, but it cannot migrate JSON values itself.
    if (!this.supported) await this.dataSource.transaction(normalizeStoredWordOrigins);
    // SQLite builds the registry empty (synchronize); on Postgres the
    // migration that created it registered `public` already
    let fallback = await this.datasetsRep.findOne({ where: { name: DEFAULT_DATASET_NAME } });
    if (!fallback) {
      const version = await this.settingsRep.findOne({ where: { field: DATASET_VERSION_SETTINGS_FIELD } });
      fallback = await this.datasetsRep.save(
        this.datasetsRep.create({
          name: DEFAULT_DATASET_NAME,
          ...OWN_DATASET_PROVENANCE,
          version: version?.value ?? null,
          imported_at: null,
          activated_at: null,
        }),
      );
    }

    await this.syncTerms();
    fallback = (await this.datasetsRep.findOne({ where: { name: DEFAULT_DATASET_NAME } })) ?? fallback;

    const setting = await this.settingsRep.findOne({ where: { field: ACTIVE_DATASET_SETTINGS_FIELD } });
    const named = setting ? await this.datasetsRep.findOne({ where: { name: setting.value } }) : null;
    this.active = named ?? fallback;
    if (!setting || !named) {
      await this.settingsRep.save({ field: ACTIVE_DATASET_SETTINGS_FIELD, value: this.active.name });
    }
    if (!this.supported)
      await this.dataSource
        .getRepository(EnWord)
        .update({ origins: IsNull(), base_form: IsNull() }, { origins: defaultOrigins(this.active) });
  }

  /**
   * The terms of a dataset of the catalog are what the catalog of this
   * version says: a correction of an attribution line reaches the instances
   * that installed the dataset before it, and nothing typed into the
   * registry survives. A dataset of the owner's is left as it was stated.
   */
  private async syncTerms(): Promise<void> {
    for (const dataset of await this.datasetsRep.find()) {
      const entry = catalogEntryOf(dataset);
      if (!entry) continue;
      const terms = registryTerms(entry);
      if (TERMS_FIELDS.every((field) => dataset[field] === terms[field])) continue;
      await this.datasetsRep.save(Object.assign(dataset, terms));
      this.logger.log(`Dataset "${dataset.name}": terms brought to the ones of the catalog`);
    }
  }

  /** Called with the dataset that has just become active, or whose terms changed while active */
  onActiveChanged(listener: ActiveListenerT): void {
    this.listeners.push(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.active);
      } catch (error) {
        this.logger.warn(
          `A dataset listener failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Called when the datasets of the instance changed: one installed, filled
   * by an import, activated, deleted, its terms or — for one that is not
   * served — its content edited
   */
  onRegistryChanged(listener: RegistryListenerT): void {
    this.registryListeners.push(listener);
  }

  private notifyRegistry(): void {
    for (const listener of this.registryListeners) {
      try {
        listener();
      } catch (error) {
        this.logger.warn(
          `A dataset listener failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * The content of a dataset that is not served was edited (issue #540):
   * what the reads of every dataset answer changed, although no dataset was
   * installed, activated or deleted
   */
  contentChanged(dataset: Dataset): void {
    if (dataset.name !== this.active.name) this.notifyRegistry();
  }

  /** Refresh in-memory terms only after the reconciliation transaction committed. */
  reconciliationCommitted(dataset: Dataset): void {
    if (dataset.id === this.active.id) {
      this.active = dataset;
      this.notify();
    }
    this.notifyRegistry();
  }

  async onModuleDestroy(): Promise<void> {
    await this.importStatus?.waitForBackground();
    await this.forkWork;
  }

  getActive(): Dataset {
    return requestDefault() ?? this.active;
  }

  toT(dataset: Dataset): DatasetT {
    return {
      name: dataset.name,
      description: dataset.description ?? null,
      origins: dataset.origins ?? [],
      title: titleOf(dataset),
      own: isOwnDataset(dataset),
      installed: true,
      is_public: dataset.is_public,
      source: dataset.source,
      language: dataset.language,
      version: dataset.version,
      license: dataset.license,
      license_url: dataset.license_url,
      attribution: dataset.attribution,
      attribution_url: dataset.attribution_url,
      notice: dataset.notice,
      license_text: dataset.license_text,
      active: dataset.name === this.active.name,
      is_default: dataset.name === DEFAULT_DATASET_NAME,
      created_at: new Date(dataset.createdAt).toISOString(),
      imported_at: dataset.imported_at ? new Date(dataset.imported_at).toISOString() : null,
    };
  }

  /** A dataset of the catalog the instance does not hold */
  private absent(entry: DatasetCatalogEntryT): DatasetT {
    return {
      name: entry.name,
      own: false,
      installed: false,
      is_public: false,
      ...registryTerms(entry),
      title: entry.title,
      version: null,
      active: false,
      is_default: false,
      created_at: null,
      imported_at: null,
    };
  }

  /** Every dataset of the catalog, installed or not, in the order of the catalog */
  async list(): Promise<DatasetsListT> {
    const installed = await this.datasetsRep.find({ order: { id: 'ASC' } });
    const byName = new Map(installed.map((dataset) => [dataset.name, dataset]));
    return {
      supported: this.supported,
      active: this.active.name,
      datasets: [
        ...DATASET_CATALOG.map((entry) => {
          const dataset = byName.get(entry.name);
          // a dataset of the owner's under the name of an entry holds nothing of it
          return dataset && !dataset.own ? this.toT(dataset) : this.absent(entry);
        }),
        // the datasets of the instance's own (issue #540), and a dataset of a
        // version that knew a source this one does not
        ...installed.filter((dataset) => !catalogEntryOf(dataset)).map((dataset) => this.toT(dataset)),
      ],
    };
  }

  /** The datasets the instance holds, the active one included */
  async installed(manager?: EntityManager): Promise<Dataset[]> {
    return (manager?.getRepository(Dataset) ?? this.datasetsRep).find({ order: { id: 'ASC' } });
  }

  /**
   * When the datasets of the instance last changed as a set: one was
   * installed, activated or deleted. Null on an instance where none of it
   * ever happened.
   */
  async changedAt(): Promise<Date | null> {
    const [installed, removed] = await Promise.all([
      this.installed(),
      this.settingsRep.findOne({ where: { field: DATASET_REMOVED_AT_SETTINGS_FIELD } }),
    ]);
    const instants = installed.flatMap((dataset) => [
      dataset.createdAt,
      dataset.activated_at,
      dataset.terms_updated_at,
      dataset.visibility_updated_at,
    ]);
    if (removed) instants.push(new Date(removed.value));
    return instants.reduce<Date | null>((newest, instant) => {
      const date = instant ? new Date(instant) : null;
      if (!date || Number.isNaN(date.getTime())) return newest;
      return !newest || date > newest ? date : newest;
    }, null);
  }

  /** Public transports share this selection; admin readers keep using installed()/find(). */
  async publiclyReadable(): Promise<Dataset[]> {
    return this.datasetsRep.find({ where: { is_public: true }, order: { id: 'ASC' } });
  }

  /** Resolve only publicly readable targets; never reveal a closed registry row. */
  async selectPublic(names: readonly string[]): Promise<Dataset[]> {
    const readable = await this.publiclyReadable();
    const selected = readable.filter((dataset) => names.includes(dataset.name));
    if (selected.length !== new Set(names).size) throw new NotFoundException(ErrorCodes.dataset_not_found);
    return selected;
  }

  /** Public intake: pin the target, its terms/version and its queue to one connection. */
  async withPublicDataset<T>(name: string | undefined, work: (dataset: Dataset) => Promise<T>): Promise<T> {
    return this.withPublicScope(name, work, true);
  }

  /** Pin the public registry row and a repeatable dictionary snapshot. */
  async withPublicRead<T>(
    name: string | undefined,
    work: (dataset: Dataset) => Promise<T>,
    expectedId?: number,
  ): Promise<T> {
    return this.withPublicScope(name, work, false, expectedId);
  }

  private async withPublicScope<T>(
    name: string | undefined,
    work: (dataset: Dataset) => Promise<T>,
    intake: boolean,
    expectedId?: number,
  ): Promise<T> {
    const dataset = name === undefined ? this.getActive() : (await this.selectPublic([name]))[0];
    if (expectedId !== undefined && dataset.id !== expectedId)
      throw new NotFoundException(ErrorCodes.dataset_not_found);
    const dataSource = await this.reader(dataset);
    const runner = dataSource.createQueryRunner();
    try {
      await runner.connect();
      if (this.supported) {
        await runner.startTransaction(intake ? 'READ COMMITTED' : 'REPEATABLE READ');
      }
      const query = runner.manager
        .getRepository(Dataset)
        .createQueryBuilder('dataset')
        .where('dataset.id = :id AND dataset.is_public = :open', { id: dataset.id, open: true });
      // Intake serializes submissions; readers share the lock. Both hold visibility/terms.
      // SQLite has one shared connection and cannot nest concurrent transactions.
      if (this.supported) query.setLock(intake ? 'pessimistic_write' : 'pessimistic_read');
      const current = await query.getOne();
      if (!current) throw new NotFoundException(ErrorCodes.dataset_not_found);
      const result = await withDatasetScope({ dataset: current, dataSource, manager: runner.manager }, () =>
        work(current),
      );
      if (runner.isTransactionActive) await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async setVisibility(name: string, isPublic: boolean): Promise<DatasetT> {
    this.requireSupported();
    return this.exclusive(async () => {
      const dataset = await this.find(name);
      if (!isPublic && dataset.name === this.active.name) {
        throw new ConflictException(ErrorCodes.dataset_active_must_be_public);
      }
      if (dataset.is_public === isPublic) return this.toT(dataset);
      const before = dataset.is_public;
      const changed = new Date();
      await this.datasetsRep.update(dataset.id, { is_public: isPublic, visibility_updated_at: changed });
      dataset.is_public = isPublic;
      dataset.visibility_updated_at = changed;
      this.notifyRegistry();
      await this.auditService?.record({
        action: AuditActionE.update,
        entityType: AuditEntityTypeE.dataset,
        entityId: dataset.id,
        headword: dataset.name,
        diff: { is_public: { before, after: isPublic } },
      });
      return this.toT(dataset);
    });
  }

  async find(name: string): Promise<Dataset> {
    const dataset = await this.datasetsRep.findOne({ where: { name } });
    if (!dataset) throw new NotFoundException(ErrorCodes.dataset_not_found);
    return dataset;
  }

  private requireSupported(): void {
    if (!this.supported) throw new ConflictException(ErrorCodes.datasets_not_supported);
  }

  /** One structural change at a time, and never under a running import — unless the import itself asks */
  private acquireExclusive(options: { forImport?: boolean } = {}): () => void {
    if (this.busy) throw new ConflictException(ErrorCodes.datasets_busy);
    if (this.importStatus?.running && !options.forImport) {
      throw new ConflictException(ErrorCodes.import_in_progress);
    }
    this.busy = true;
    return () => {
      this.busy = false;
    };
  }

  private async exclusive<T>(work: () => Promise<T>, options: { forImport?: boolean } = {}): Promise<T> {
    const release = this.acquireExclusive(options);
    try {
      return await work();
    } finally {
      release();
    }
  }

  /**
   * Registers an empty dictionary under the catalog's terms. Answers the dataset that is there when it already is.
   */
  async install(name: string, options: { forImport?: boolean } = {}): Promise<Dataset> {
    this.requireSupported();
    const entry = findCatalogEntry(name);
    if (!entry || entry.name === DEFAULT_DATASET_NAME) {
      throw new BadRequestException(ErrorCodes.dataset_name_invalid);
    }
    return this.exclusive(async () => {
      const existing = await this.datasetsRep.findOne({ where: { name } });
      // the name of a later entry of the catalog, taken by a dataset of the owner's: never filled with the source
      if (existing?.own) throw new ConflictException(ErrorCodes.dataset_already_exists);
      if (existing) return existing;
      const dataset = await this.datasetsRep.save(
        this.datasetsRep.create({
          name,
          own: false,
          is_public: false,
          ...registryTerms(entry),
          version: null,
          imported_at: null,
          activated_at: null,
        }),
      );
      this.logger.log(`Dataset "${dataset.name}" created`);
      this.notifyRegistry();
      await this.auditService?.record({
        action: AuditActionE.create,
        entityType: AuditEntityTypeE.dataset,
        entityId: dataset.id,
        headword: dataset.name,
        diff: {
          source: { before: null, after: dataset.source },
          license: { before: null, after: dataset.license },
        },
      });
      return dataset;
    }, options);
  }

  /**
   * Registers an empty dataset under its owner's terms (issue #540). Its `source` in the public API is its name. The names
   * of the catalog, of its datasets and of its sources, are not taken.
   */
  async create(request: CreateDatasetReqT): Promise<DatasetT> {
    this.requireSupported();
    const name = request.name;
    if (!DATASET_NAME_PATTERN.test(name)) throw new BadRequestException(ErrorCodes.dataset_name_invalid);
    if (isReservedDatasetName(name)) throw new ConflictException(ErrorCodes.dataset_name_reserved);
    const license = licenseTermsOf(request.license);
    assertOriginsEdit([], request.origins ?? []);
    assertCompatibleOrigins(request.origins ?? [], license.license);
    return this.exclusive(async () => {
      if (await this.datasetsRep.findOne({ where: { name } })) {
        throw new ConflictException(ErrorCodes.dataset_already_exists);
      }
      const dataset = await this.datasetsRep.save(
        this.datasetsRep.create({
          name,
          own: true,
          is_public: false,
          source: name,
          language: 'en',
          title: request.title.trim(),
          ...license,
          attribution: request.attribution.trim(),
          attribution_url: request.attribution_url?.trim() || null,
          description: request.description?.trim() || null,
          notice: request.notice?.trim() || null,
          origins: request.origins ?? [],
          version: request.version?.trim() || null,
          imported_at: null,
          activated_at: null,
        }),
      );
      this.logger.log(`Dataset "${dataset.name}" of the instance's own created`);
      this.notifyRegistry();
      await this.auditService?.record({
        action: AuditActionE.create,
        entityType: AuditEntityTypeE.dataset,
        entityId: dataset.id,
        headword: dataset.name,
        diff: {
          source: { before: null, after: dataset.source },
          title: { before: null, after: dataset.title },
          version: { before: null, after: dataset.version },
          license: { before: null, after: dataset.license },
          license_url: { before: null, after: dataset.license_url },
        },
      });
      return this.toT(dataset);
    });
  }

  /**
   * Corrects the terms of a dataset of the owner's (issue #540). The title
   * and the attribution are corrections; a new license is a decision the
   * admin UI confirms first, and the journal keeps the license before and
   * after. Nothing about a dataset of the catalog is edited.
   */
  forkProgress(name: string): ForkProgressT {
    const progress = this.forks.get(name);
    if (!progress) throw new NotFoundException(ErrorCodes.dataset_not_found);
    return { ...progress };
  }

  async fork(parentName: string, request: CreateDatasetReqT): Promise<ForkProgressT> {
    this.requireSupported();
    if (!DATASET_NAME_PATTERN.test(request.name))
      throw new BadRequestException(ErrorCodes.dataset_name_invalid);
    if (isReservedDatasetName(request.name)) throw new ConflictException(ErrorCodes.dataset_name_reserved);
    // Reserve synchronously, before preflight reads can interleave with another fork.
    const release = this.acquireExclusive();
    try {
      if (await this.datasetsRep.existsBy({ name: request.name }))
        throw new ConflictException(ErrorCodes.dataset_already_exists);
      const source = await this.find(parentName);
      const license = licenseTermsOf(request.license);
      assertOriginsEdit([], request.origins ?? []);
      assertCompatibleOrigins(defaultOrigins(source), license.license);
      const target = this.datasetsRep.create({
        name: request.name,
        own: true,
        is_public: false,
        source: request.name,
        language: source.language,
        title: request.title.trim(),
        ...license,
        attribution: request.attribution.trim(),
        attribution_url: request.attribution_url?.trim() || null,
        notice: request.notice?.trim() || null,
        description: request.description?.trim() || null,
        origins: request.origins ?? [],
        version: request.version?.trim() || null,
        imported_at: null,
        activated_at: null,
      });
      const progress: ForkProgressT = {
        name: target.name,
        parent: source.name,
        state: 'copying',
        completed_tables: 0,
        total_tables: 0,
      };
      this.forks.set(target.name, progress);
      this.forkWork = (async () => {
        const saved = await forkDataset(this.dataSource, source, target, progress);
        this.notifyRegistry();
        await this.auditService?.record({
          action: AuditActionE.create,
          entityType: AuditEntityTypeE.dataset,
          entityId: saved.id,
          headword: saved.name,
          diff: {
            origins: { before: null, after: saved.origins },
            version: { before: null, after: saved.version },
          },
        });
      })()
        .finally(release)
        .then(() => {
          progress.state = 'completed';
        })
        .catch((error: unknown) => {
          progress.state = 'failed';
          progress.failure =
            error instanceof ConflictException ? String(error.message) : ErrorCodes.internal_server_error;
          this.logger.error(`Fork "${target.name}" failed: ${String(error)}`);
        });
      return { ...progress };
    } catch (error) {
      release();
      throw error;
    }
  }

  async updateTerms(name: string, request: UpdateDatasetReqT): Promise<DatasetT> {
    return this.exclusive(() => this.updateTermsUnlocked(name, request));
  }

  private async updateTermsUnlocked(name: string, request: UpdateDatasetReqT): Promise<DatasetT> {
    this.requireSupported();
    const dataset = await this.find(name);
    if (!isOwnDataset(dataset)) throw new ConflictException(ErrorCodes.dataset_terms_fixed);
    if (request.origins !== undefined) assertOriginsEdit(dataset.origins ?? [], request.origins);
    const next: Partial<Dataset> = {
      ...(request.version !== undefined && { version: request.version?.trim() || null }),
      ...(request.description !== undefined && { description: request.description?.trim() || null }),
      ...(request.notice !== undefined && { notice: request.notice?.trim() || null }),
      ...(request.origins !== undefined && { origins: request.origins }),
      ...(request.title !== undefined && { title: request.title.trim() }),
      ...(request.attribution !== undefined && { attribution: request.attribution.trim() }),
      ...(request.attribution_url !== undefined && {
        attribution_url: request.attribution_url?.trim() || null,
      }),
      ...(request.license && licenseTermsOf(request.license)),
    };
    assertCompatibleOrigins(next.origins ?? dataset.origins ?? [], next.license ?? dataset.license);
    if (next.license && next.license !== dataset.license) {
      const connection = await this.reader(dataset);
      const words = await connection
        .getRepository(EnWord)
        .createQueryBuilder('word')
        .select('word.origins', 'origins')
        .where('word.origins IS NOT NULL')
        .distinct(true)
        .getRawMany<{ origins: string }>();
      for (const word of words)
        assertCompatibleOrigins(JSON.parse(word.origins) as import('../../../types').OriginT[], next.license);
      const contributions = await connection
        .getRepository(EnChange)
        .createQueryBuilder('change')
        .select('change.contribution', 'contribution')
        .distinct(true)
        .where('change.superseded_at IS NULL AND change.contribution IS NOT NULL')
        .getRawMany<{ contribution: string }>();
      for (const change of contributions)
        assertCompatibleOrigins(
          [JSON.parse(change.contribution) as import('../../../types').OriginT],
          next.license,
        );
    }
    const diff: AuditDiffT = {};
    for (const [field, after] of Object.entries(next) as Array<[keyof Dataset, string | null]>) {
      const before = dataset[field] as string | null;
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      diff[field] =
        field === 'license_text' ? { before: forAudit(before), after: forAudit(after) } : { before, after };
    }
    if (!Object.keys(diff).length) return this.toT(dataset);

    const saved = await this.datasetsRep.save(Object.assign(dataset, next, { terms_updated_at: new Date() }));
    if (saved.name === this.active.name) {
      if (diff.version) {
        if (saved.version) {
          await this.settingsRep.save({ field: DATASET_VERSION_SETTINGS_FIELD, value: saved.version });
        } else {
          await this.settingsRep.delete({ field: DATASET_VERSION_SETTINGS_FIELD });
        }
      }
      this.active = saved;
      this.notify();
    }
    this.notifyRegistry();
    this.logger.log(`Dataset "${saved.name}": terms changed (${Object.keys(diff).join(', ')})`);
    await this.auditService?.record({
      action: AuditActionE.update,
      entityType: AuditEntityTypeE.dataset,
      entityId: saved.id,
      headword: saved.name,
      diff,
    });
    return this.toT(saved);
  }

  /** What an import leaves on the dataset it filled: the version and the day */
  async recordImport(
    name: string,
    imported: {
      version?: string | null | undefined;
      provenance?: import('../../../types').DatasetProvenanceSnapshotT;
    },
    transaction?: EntityManager,
  ): Promise<Dataset> {
    const dataset = transaction ? await transaction.findOneByOrFail(Dataset, { name }) : await this.find(name);
    if (imported.version !== undefined) dataset.version = imported.version || null;
    if (imported.provenance)
      Object.assign(
        dataset,
        isOwnDataset(dataset) ? imported.provenance : { origins: imported.provenance.origins },
        { terms_updated_at: new Date() },
      );
    dataset.imported_at = new Date();
    const saved = await (transaction?.getRepository(Dataset) ?? this.datasetsRep).save(dataset);
    if (saved.id === this.active.id && imported.version !== undefined) {
      const settings = transaction?.getRepository(Settings) ?? this.settingsRep;
      if (saved.version) await settings.save({ field: DATASET_VERSION_SETTINGS_FIELD, value: saved.version });
      else await settings.delete({ field: DATASET_VERSION_SETTINGS_FIELD });
    }
    if (!transaction) this.reconciliationCommitted(saved);
    return saved;
  }

  /**
   * The dataset an import names: installed already, or installed now from
   * the catalog. Without a name, the active one.
   */
  async resolveTarget(name: string | undefined): Promise<Dataset> {
    // The import has taken its own slot; a fork/activation may have acquired
    // the structural lock first. Refuse before opening or writing its target.
    if (this.busy) throw new ConflictException(ErrorCodes.datasets_busy);
    if (!name || name === this.getActive().name) return this.getActive();
    this.requireSupported();
    const existing = await this.datasetsRep.findOne({ where: { name } });
    // the import that asks holds the import slot already
    return existing ?? this.install(name, { forImport: true });
  }

  async connect(dataset: Dataset): Promise<DatasetConnectionT> {
    return { dataset, manager: (await this.reader(dataset)).manager, close: async () => undefined };
  }

  async reader(dataset: Dataset): Promise<DataSource> {
    if (dataset.name !== this.active.name) this.requireSupported();
    return dictionaryConnection(this.dataSource, dataset.id);
  }

  async activate(name: string): Promise<DatasetT> {
    this.requireSupported();
    return this.exclusive(async () => {
      const dataset = await this.find(name);
      if (!dataset.is_public) throw new ConflictException(ErrorCodes.dataset_is_closed);
      const previous = this.active;
      if (dataset.name === previous.name) return this.toT(dataset);

      const saved = await this.dataSource.transaction(async (em) => {
        dataset.activated_at = new Date();
        const updated = await em.save(Dataset, dataset);
        await em.save(Settings, { field: ACTIVE_DATASET_SETTINGS_FIELD, value: dataset.name });
        if (dataset.version)
          await em.save(Settings, { field: DATASET_VERSION_SETTINGS_FIELD, value: dataset.version });
        else await em.delete(Settings, { field: DATASET_VERSION_SETTINGS_FIELD });
        return updated;
      });
      this.active = saved;
      this.notify();
      this.notifyRegistry();
      this.logger.log(`Active dataset: "${dataset.name}", was "${previous.name}"`);
      await this.auditService?.record({
        action: AuditActionE.update,
        entityType: AuditEntityTypeE.dataset,
        entityId: dataset.id,
        headword: dataset.name,
        diff: { active: { before: previous.name, after: dataset.name } },
      });
      return this.toT(this.active);
    });
  }

  async remove(name: string): Promise<void> {
    this.requireSupported();
    await this.exclusive(async () => {
      const dataset = await this.find(name);
      if (dataset.name === DEFAULT_DATASET_NAME) throw new ConflictException(ErrorCodes.dataset_is_default);
      if (dataset.name === this.active.name) throw new ConflictException(ErrorCodes.dataset_is_active);
      await this.dataSource.transaction(async (em) => {
        await em.delete(Dataset, { id: dataset.id });
        await em.save(Settings, { field: DATASET_REMOVED_AT_SETTINGS_FIELD, value: new Date().toISOString() });
      });
      this.notifyRegistry();
      this.logger.log(`Dataset "${dataset.name}" deleted`);
      await this.auditService?.record({
        action: AuditActionE.delete,
        entityType: AuditEntityTypeE.dataset,
        entityId: dataset.id,
        headword: dataset.name,
        diff: {
          source: { before: dataset.source, after: null },
          version: { before: dataset.version, after: null },
        },
      });
    });
  }
}
