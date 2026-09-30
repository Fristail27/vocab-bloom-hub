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
import { DataSource, EntityManager, Repository } from 'typeorm';
import { checkIsPostgres } from '../../../configuration';
import {
  ACTIVE_DATASET_SETTINGS_FIELD,
  DATASET_NAME_PATTERN,
  DATASET_REMOVED_AT_SETTINGS_FIELD,
  DEFAULT_DATASET_NAME,
  DEFAULT_DATASET_SCHEMA,
  datasetSchemaOf,
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
import { setActiveDataset } from '../../core/utils/active-dataset';
import { getDbPoolConfig } from '../../core/utils/db-pool';
import { createDatasetSchema, dropDatasetSchema, searchPathExtra } from '../../db/datasets';
import { DB_ENTITIES } from '../../db/typeorm-options';
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

// an import is one writer: a few connections are plenty
const SIDE_CONNECTION_POOL = 4;

// the public reads of a dataset that is not the served one (issue #528) are
// rare next to the reads of the served one: a small pool, whose idle
// connections are closed like the ones of the application's pool
export const READ_CONNECTION_POOL = 4;

/**
 * The datasets of the instance and the active one (issue #527). What an
 * instance can hold is the catalog the code ships; the registry says which
 * of them are installed. On Postgres a dataset is a schema with the
 * dictionary tables in it, and activating one re-opens the application's
 * connection with that schema first in its search_path — the entities, the
 * repositories and every query stay what they are. On SQLite there is the
 * default dataset and nothing to switch.
 */
@Injectable()
export class DatasetsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatasetsService.name);

  /** Whether the driver has schemas: creating, activating and deleting datasets */
  readonly supported = checkIsPostgres();

  @Optional()
  @Inject(AuditService)
  private readonly auditService?: AuditService;

  /** Requests wait for a switch and a switch for the requests: the connection is closed in between */
  readonly gate = new SwitchGate();

  private current!: Dataset;
  private busy = false;

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

  // the connections the datasets that are not served are read through, by the name of the dataset
  private readonly readers = new Map<string, Promise<DataSource>>();

  constructor(
    @InjectRepository(Dataset) private readonly datasetsRep: Repository<Dataset>,
    @InjectRepository(Settings) private readonly settingsRep: Repository<Settings>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() private readonly importStatus?: ImportStatusService,
  ) {}

  async onModuleInit(): Promise<void> {
    // SQLite builds the registry empty (synchronize); on Postgres the
    // migration that created it registered `public` already
    let fallback = await this.datasetsRep.findOne({ where: { name: DEFAULT_DATASET_NAME } });
    if (!fallback) {
      const version = await this.settingsRep.findOne({ where: { field: DATASET_VERSION_SETTINGS_FIELD } });
      fallback = await this.datasetsRep.save(
        this.datasetsRep.create({
          name: DEFAULT_DATASET_NAME,
          schema: DEFAULT_DATASET_SCHEMA,
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
    if (this.supported) await this.assertOnSchema(this.active.schema);
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

  /**
   * A connection must be on the schema of its dataset: a pooler that drops
   * startup options leaves it on `public`, and the data of one dataset
   * would be served under the terms of another
   */
  private async assertOnSchema(schema: string, dataSource: DataSource = this.dataSource): Promise<void> {
    const [{ current }] = (await dataSource.query('SELECT current_schema() AS "current"')) as Array<{
      current: string;
    }>;
    if (current !== schema) {
      throw new Error(
        `The database connection is on schema "${current}", the dataset lives in "${schema}": ` +
          'the search_path startup option did not reach Postgres (a connection pooler in between?)',
      );
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

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.readers.keys()].map((name) => this.closeReader(name)));
  }

  getActive(): Dataset {
    return this.active;
  }

  toT(dataset: Dataset): DatasetT {
    return {
      name: dataset.name,
      title: titleOf(dataset),
      own: isOwnDataset(dataset),
      installed: true,
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
  async installed(): Promise<Dataset[]> {
    return this.datasetsRep.find({ order: { id: 'ASC' } });
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
    const instants = installed.flatMap((dataset) => [dataset.createdAt, dataset.activated_at]);
    if (removed) instants.push(new Date(removed.value));
    return instants.reduce<Date | null>((newest, instant) => {
      const date = instant ? new Date(instant) : null;
      if (!date || Number.isNaN(date.getTime())) return newest;
      return !newest || date > newest ? date : newest;
    }, null);
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
  private async exclusive<T>(work: () => Promise<T>, options: { forImport?: boolean } = {}): Promise<T> {
    if (this.busy) throw new ConflictException(ErrorCodes.datasets_busy);
    if (this.importStatus?.running && !options.forImport) {
      throw new ConflictException(ErrorCodes.import_in_progress);
    }
    this.busy = true;
    try {
      return await work();
    } finally {
      this.busy = false;
    }
  }

  /**
   * Installs a dataset of the catalog: its schema with the dictionary
   * tables, empty, and its row in the registry with the terms the catalog
   * states. Answers the dataset that is there when it already is.
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
      const schema = datasetSchemaOf(name);
      await createDatasetSchema(schema);
      const dataset = await this.datasetsRep.save(
        this.datasetsRep.create({
          name,
          schema,
          own: false,
          ...registryTerms(entry),
          version: null,
          imported_at: null,
          activated_at: null,
        }),
      );
      this.logger.log(`Dataset "${dataset.name}" created in schema "${schema}"`);
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
   * Creates an empty dataset of the instance's own (issue #540): a schema
   * with the dictionary tables and a row in the registry under the terms
   * the owner states. Its `source` in the public API is its name. The names
   * of the catalog, of its datasets and of its sources, are not taken.
   */
  async create(request: CreateDatasetReqT): Promise<DatasetT> {
    this.requireSupported();
    const name = request.name;
    if (!DATASET_NAME_PATTERN.test(name)) throw new BadRequestException(ErrorCodes.dataset_name_invalid);
    if (isReservedDatasetName(name)) throw new ConflictException(ErrorCodes.dataset_name_reserved);
    const license = licenseTermsOf(request.license);
    return this.exclusive(async () => {
      if (await this.datasetsRep.findOne({ where: { name } })) {
        throw new ConflictException(ErrorCodes.dataset_already_exists);
      }
      const schema = datasetSchemaOf(name);
      await createDatasetSchema(schema);
      const dataset = await this.datasetsRep.save(
        this.datasetsRep.create({
          name,
          schema,
          own: true,
          source: name,
          language: 'en',
          title: request.title.trim(),
          ...license,
          attribution: request.attribution.trim(),
          attribution_url: request.attribution_url?.trim() || null,
          notice: null,
          version: null,
          imported_at: null,
          activated_at: null,
        }),
      );
      this.logger.log(`Dataset "${dataset.name}" of the instance's own created in schema "${schema}"`);
      this.notifyRegistry();
      await this.auditService?.record({
        action: AuditActionE.create,
        entityType: AuditEntityTypeE.dataset,
        entityId: dataset.id,
        headword: dataset.name,
        diff: {
          source: { before: null, after: dataset.source },
          title: { before: null, after: dataset.title },
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
  async updateTerms(name: string, request: UpdateDatasetReqT): Promise<DatasetT> {
    this.requireSupported();
    const dataset = await this.find(name);
    if (!isOwnDataset(dataset)) throw new ConflictException(ErrorCodes.dataset_terms_fixed);
    const next: Partial<Dataset> = {
      ...(request.title !== undefined && { title: request.title.trim() }),
      ...(request.attribution !== undefined && { attribution: request.attribution.trim() }),
      ...(request.attribution_url !== undefined && {
        attribution_url: request.attribution_url?.trim() || null,
      }),
      ...(request.license && licenseTermsOf(request.license)),
    };
    const diff: AuditDiffT = {};
    for (const [field, after] of Object.entries(next) as Array<[keyof Dataset, string | null]>) {
      const before = dataset[field] as string | null;
      if (before === after) continue;
      diff[field] =
        field === 'license_text' ? { before: forAudit(before), after: forAudit(after) } : { before, after };
    }
    if (!Object.keys(diff).length) return this.toT(dataset);

    const saved = await this.datasetsRep.save(Object.assign(dataset, next));
    if (saved.name === this.active.name) {
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
  async recordImport(name: string, imported: { version?: string | undefined }): Promise<void> {
    const dataset = await this.find(name);
    if (imported.version) dataset.version = imported.version;
    dataset.imported_at = new Date();
    const saved = await this.datasetsRep.save(dataset);
    if (saved.name === this.active.name) {
      this.active = saved;
      this.notify();
    }
    this.notifyRegistry();
  }

  /**
   * The dataset an import names: installed already, or installed now from
   * the catalog. Without a name, the active one.
   */
  async resolveTarget(name: string | undefined): Promise<Dataset> {
    if (!name || name === this.active.name) return this.active;
    this.requireSupported();
    const existing = await this.datasetsRep.findOne({ where: { name } });
    // the import that asks holds the import slot already
    return existing ?? this.install(name, { forImport: true });
  }

  /**
   * Opens a dataset for reading and writing. The active dataset is reached
   * through the application's connection; any other through a connection of
   * its own on that dataset's schema, closed by `close()` — the active
   * dataset keeps serving while an import fills another one.
   */
  async connect(dataset: Dataset): Promise<DatasetConnectionT> {
    if (dataset.name === this.active.name) {
      return { dataset, manager: this.dataSource.manager, close: async () => undefined };
    }
    this.requireSupported();
    const side = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL as string,
      entities: DB_ENTITIES,
      synchronize: false,
      migrationsRun: false,
      extra: { max: SIDE_CONNECTION_POOL, ...searchPathExtra(dataset.schema) },
    });
    await side.initialize();
    return {
      dataset,
      manager: side.manager,
      close: async () => {
        if (side.isInitialized) await side.destroy();
      },
    };
  }

  /**
   * The connection a dataset is read through (issue #528): the
   * application's own for the active one, otherwise a connection on that
   * dataset's schema that is opened by the first read and kept — a public
   * request cannot pay for a pool of its own, as an import does with
   * `connect()`. The admin edits a dataset that is not served through it as
   * well (issue #540). Closed when the dataset is deleted or becomes the
   * active one, and when the server stops.
   */
  async reader(dataset: Dataset): Promise<DataSource> {
    if (dataset.name === this.active.name) return this.dataSource;
    this.requireSupported();
    const kept = this.readers.get(dataset.name);
    if (kept) return kept;
    const opened = this.openReader(dataset);
    this.readers.set(dataset.name, opened);
    // a connection that could not be opened is tried again by the next read
    opened.catch(() => {
      if (this.readers.get(dataset.name) === opened) this.readers.delete(dataset.name);
    });
    return opened;
  }

  private async openReader(dataset: Dataset): Promise<DataSource> {
    const reader = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL as string,
      entities: DB_ENTITIES,
      synchronize: false,
      migrationsRun: false,
      extra: {
        max: READ_CONNECTION_POOL,
        idleTimeoutMillis: getDbPoolConfig().idleTimeoutSeconds * 1000,
        ...searchPathExtra(dataset.schema),
      },
    });
    await reader.initialize();
    try {
      await this.assertOnSchema(dataset.schema, reader);
    } catch (error) {
      await reader.destroy();
      this.logger.error(
        `Dataset "${dataset.name}" cannot be read: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
    return reader;
  }

  private async closeReader(name: string): Promise<void> {
    const kept = this.readers.get(name);
    if (!kept) return;
    this.readers.delete(name);
    try {
      const reader = await kept;
      if (reader.isInitialized) await reader.destroy();
    } catch (error) {
      this.logger.warn(
        `The read connection of dataset "${name}" was not closed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Re-opens the application's connection on a schema; the DataSource object and its repositories stay */
  private async reconnect(schema: string): Promise<void> {
    const extra = this.dataSource.options.extra as Record<string, unknown>;
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
    delete extra.options;
    Object.assign(extra, searchPathExtra(schema));
    // applied at start, in every schema; on a dataset's connection the journal
    // of `public` would not be found and the shared migrations would run again
    (this.dataSource.options as { migrationsRun?: boolean }).migrationsRun = false;
    // the driver remembers the schema of its first connection
    const driver = this.dataSource.driver as unknown as { searchSchema?: string; schema?: string };
    driver.searchSchema = undefined;
    driver.schema = undefined;
    await this.dataSource.initialize();
    await this.assertOnSchema(schema);
  }

  async activate(name: string): Promise<DatasetT> {
    this.requireSupported();
    return this.exclusive(async () => {
      const dataset = await this.find(name);
      const previous = this.active;
      if (dataset.name === previous.name) return this.toT(dataset);

      // no request runs into the closed connection, none is answered from
      // one dataset under the terms of the other
      const { abandoned } = await this.gate.hold(async () => {
        try {
          await this.reconnect(dataset.schema);
        } catch (error) {
          this.logger.error(
            `Switching to dataset "${dataset.name}" failed, staying on "${previous.name}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          await this.reconnect(previous.schema);
          throw error;
        }

        dataset.activated_at = new Date();
        this.active = await this.datasetsRep.save(dataset);
        await this.settingsRep.save({ field: ACTIVE_DATASET_SETTINGS_FIELD, value: dataset.name });
        // the settings field the admin UI and the first-start import read mirrors the active dataset
        if (dataset.version) {
          await this.settingsRep.save({ field: DATASET_VERSION_SETTINGS_FIELD, value: dataset.version });
        } else {
          await this.settingsRep.delete({ field: DATASET_VERSION_SETTINGS_FIELD });
        }
        this.notify();
      });
      // the dataset is read through the application's connection from now on
      await this.closeReader(dataset.name);
      this.notifyRegistry();
      if (abandoned) {
        this.logger.warn(
          `${abandoned} request(s) were still running when the dataset was switched and may have failed`,
        );
      }
      this.logger.log(`Active dataset: "${dataset.name}" (${dataset.schema}), was "${previous.name}"`);
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
      await dropDatasetSchema(dataset.schema);
      await this.datasetsRep.delete({ id: dataset.id });
      // no read finds the dataset in the registry any more: its connection is not opened again
      await this.closeReader(dataset.name);
      await this.settingsRep.save({
        field: DATASET_REMOVED_AT_SETTINGS_FIELD,
        value: new Date().toISOString(),
      });
      this.notifyRegistry();
      this.logger.log(`Dataset "${dataset.name}" deleted with its schema "${dataset.schema}"`);
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
