import { captureCurrent, commonAncestor, copyRevisionGraph } from './ancestry';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  applicationStage,
  ReconciliationApplicationSinkT,
  preparationStage,
  ReconciliationCounterT,
  ReconciliationProgressSinkT,
} from './progress';
import { EntityManager, EntityNotFoundError, QueryFailedError } from 'typeorm';
import { DatasetsService } from '../../../DatasetsModule/datasets.service';
import { ImportStatusService } from '../EnImportDictionary/importStatus.service';
import { ImportTriggerE, AuditActionE, AuditEntityTypeE, AuditTriggerE } from '../../../../../types';
import type {
  ReconciliationCategoryT,
  ReconciliationDecisionT,
  ReconciliationSideT,
  ReconciliationPreparationT,
  ReconciliationApplicationT,
} from '../../../../../types/reconciliation';
import { Dataset } from '../../../DatasetsModule/entities/dataset.entity';
import { AuditLog } from '../../../AuditModule/entities/audit_log.entity';
import { DICTIONARY_ENTITIES } from '../../entities/dictionary-entities';
import { isHumanAuthoredDataset } from '../../../../../core/constants/dataset_catalog';
import { withDatasetScope } from '../../../../core/utils/dataset-scope';
import { ReconciliationStore } from './store';
import { persistentLineage, datasetSnapshotMetadata, dictionaryRecords } from './snapshot';
import {
  ReconciliationBaseline,
  ReconciliationItem,
  ReconciliationPlan,
  ReconciliationRevision,
} from './entities';
import { object, validateDocument } from './document';
import { ReconciliationDependencies } from './dependencies';
import { publishPlan } from './publish';
import { contentHash, equalSides, present } from './compare';
import { alignDocument } from './snapshot';
import { ReconciliationRecord } from './entities';
import { Settings } from '../../../SettingsModule/entities/settings.entity';
import { DATASET_VERSION_SETTINGS_FIELD } from '../EnImportDictionary/constants';
import { batches } from './batches';

@Injectable()
export class ReconciliationService {
  private readonly applications = new Map<string, ReconciliationApplicationT>();
  private readonly preparations = new Map<string, ReconciliationPreparationT>();
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly datasets: DatasetsService,
    private readonly imports: ImportStatusService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.imports.waitForBackground();
  }

  preparation(name: string): { preparation: ReconciliationPreparationT | null } {
    const progress = this.preparations.get(name);
    return { preparation: progress ? { ...progress } : null };
  }

  application(name: string): { application: ReconciliationApplicationT | null } {
    const job = this.applications.get(name);
    return { application: job ? { ...job } : null };
  }

  private createApplication(name: string, id: string): ReconciliationApplicationT {
    this.imports.begin(ImportTriggerE.manual, `Apply merge ${id}`, name);
    const job: ReconciliationApplicationT = {
      id: randomUUID(),
      plan_id: id,
      state: 'running',
      stage: 'waiting',
      processed: 0,
      started_at: new Date().toISOString(),
    };
    this.applications.set(name, job);
    return job;
  }

  startApply(name: string, id: string): ReconciliationApplicationT {
    const job = this.createApplication(name, id);
    const work = this.applyTracked(name, id, job)
      .then(() => {})
      .catch((error: unknown) => this.logger.error(error));
    this.imports.trackBackground(work);
    return { ...job };
  }

  async apply(name: string, id: string) {
    return this.applyTracked(name, id, this.createApplication(name, id));
  }

  private async applyTracked(name: string, id: string, job: ReconciliationApplicationT) {
    try {
      const result = await this.applyWork(name, id, (stage, processed, total) => {
        job.stage = stage;
        job.processed = processed;
        if (total === undefined) delete job.total;
        else job.total = total;
      });
      job.state = 'completed';
      return result;
    } catch (error) {
      job.state = 'failed';
      job.failure =
        error instanceof Error && error.message.startsWith('reconciliation_')
          ? error.message
          : 'reconciliation_failed';
      throw error;
    } finally {
      job.finished_at = new Date().toISOString();
      this.imports.end(job.failure ? { error: job.failure } : {});
    }
  }

  /** Reserve before any awaits. The caller gets an acknowledgement, never a long-lived request. */
  startParent(name: string, sourceName: string, allowTwoWay = false): ReconciliationPreparationT {
    if (!this.datasets.supported) throw new ConflictException('datasets_not_supported');
    if (name === sourceName) throw new BadRequestException('reconciliation_same_dataset');
    this.imports.begin(ImportTriggerE.manual, `Prepare merge ${sourceName} → ${name}`, name);
    const progress: ReconciliationPreparationT = {
      id: randomUUID(),
      source: sourceName,
      state: 'running',
      stage: 'starting',
      processed: 0,
      started_at: new Date().toISOString(),
    };
    this.preparations.set(name, progress);
    const work = this.prepareParentWork(name, sourceName, allowTwoWay, (stage, processed, total) => {
      progress.stage = stage;
      progress.processed = processed;
      if (total === undefined) delete progress.total;
      else progress.total = total;
    })
      .then((plan) => {
        progress.plan_id = plan.id;
        progress.state = 'completed';
      })
      .catch((error: unknown) => {
        progress.state = 'failed';
        progress.failure =
          error instanceof Error && error.message.startsWith('reconciliation_')
            ? error.message
            : 'reconciliation_failed';
        this.logger.error(error);
      })
      .finally(() => {
        progress.finished_at = new Date().toISOString();
        this.imports.end(progress.failure ? { error: progress.failure } : {});
      });
    this.imports.trackBackground(work);
    return { ...progress };
  }

  private async on<T>(
    name: string,
    work: (store: ReconciliationStore, em: EntityManager, dataset: Dataset) => Promise<T>,
  ): Promise<T> {
    const dataset = await this.datasets.find(name);
    const connection = await this.datasets.reader(dataset);
    try {
      return await connection.transaction(
        connection.options.type === 'postgres' ? 'REPEATABLE READ' : 'SERIALIZABLE',
        async (em) => {
          const current = await em.findOneByOrFail(Dataset, { id: dataset.id });
          return work(new ReconciliationStore(em), em, current);
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        ['40001', '40P01', 'SQLITE_BUSY'].includes(String(error.driverError?.code))
      )
        throw new ConflictException('reconciliation_plan_stale');
      if (error instanceof EntityNotFoundError) throw new NotFoundException('reconciliation_not_found');
      if (error instanceof Error && error.message.startsWith('reconciliation_'))
        throw new ConflictException(error.message);
      throw error;
    }
  }

  async list(name: string, headword?: string) {
    return this.on(name, async (store, em, dataset) => {
      const query = em.createQueryBuilder(ReconciliationPlan, 'plan');
      if (headword)
        query
          .innerJoin(ReconciliationItem, 'item', 'item.plan = plan.id AND item.headword = :headword', {
            headword,
          })
          .andWhere('plan.status = :status', { status: 'applied' });
      const rows = await query.orderBy('plan.created_at', 'DESC').take(100).getMany();
      const parents = [];
      for (const baseline of await em.find(ReconciliationBaseline)) {
        const revision = await store.revision(baseline.revision);
        parents.push({
          lineage: baseline.lineage,
          source: String(revision.metadata.source),
          revision: revision.id,
        });
      }
      const sources =
        this.datasets.supported && dataset.own
          ? (await this.datasets.installed())
              .filter((candidate) => candidate.name !== name)
              .map((candidate) => ({ name: candidate.name, title: candidate.title ?? candidate.name }))
          : [];
      return { plans: rows, parents, sources };
    });
  }

  summary(name: string, id: string) {
    return this.on(name, (store) => store.summary(id));
  }
  items(name: string, id: string, page: number, category?: ReconciliationCategoryT, search?: string) {
    return this.on(name, (store) => store.list(id, page, category, search));
  }
  decide(name: string, id: string, headword: string, version: number, decisions: ReconciliationDecisionT[]) {
    return this.on(name, async (store, em, dataset) => {
      const item = await store.decide(id, headword, version, decisions);
      if (!item.remaining && item.result.present) {
        validateDocument(em, item.result.value, dataset.license, !isHumanAuthoredDataset(dataset));
        await this.validateOrigins(em, item);
      }
      return item;
    });
  }
  cancel(name: string, id: string) {
    return this.on(name, (store) => store.cancel(id));
  }
  override(name: string, id: string, headword: string, version: number, result: ReconciliationSideT) {
    return this.on(name, async (store, em, dataset) => {
      const item = await store.override(id, headword, version, result);
      if (item.result.present) {
        validateDocument(em, item.result.value, dataset.license, !isHumanAuthoredDataset(dataset));
        await this.validateOrigins(em, item);
      }
      return item;
    });
  }

  /** The source lineage is portable across instances, separate from a fork parent's identity. */
  private sourceLineage(dataset: Dataset): string {
    return contentHash({ source: dataset.source, language: dataset.language });
  }

  async rememberSource(
    name: string,
    adapter: { adapter: string; revision: number } | null = null,
  ): Promise<void> {
    await this.on(name, async (store, em, dataset) => {
      const lineage = this.sourceLineage(dataset);
      if (await em.existsBy(ReconciliationBaseline, { lineage })) return;
      const revision = await store.capture(
        lineage,
        { ...datasetSnapshotMetadata(dataset), adapter },
        true,
        dictionaryRecords(em, dataset),
      );
      await store.establish(lineage, revision.id);
    });
  }

  async prepareSource(
    name: string,
    incomingManager: EntityManager,
    version: string | undefined,
    complete: boolean,
    adapter: { adapter: string; revision: number } | null = null,
  ) {
    return this.on(name, async (store, em, dataset) => {
      const lineage = this.sourceLineage(dataset);
      const baseline = await em.findOneBy(ReconciliationBaseline, { lineage });
      const previousAdapter = baseline ? (await store.revision(baseline.revision)).metadata.adapter : null;
      if (previousAdapter && contentHash(previousAdapter) !== contentHash(adapter)) complete = false;
      async function* aligned() {
        for await (const page of batches(
          dictionaryRecords(incomingManager, { ...dataset, version: version ?? null }),
        )) {
          const previous = new Map(
            (baseline
              ? await store.recordsFor(
                  [baseline.revision],
                  page.map((row) => row.headword),
                )
              : []
            ).map((row) => [row.headword, row]),
          );
          for (const row of page) {
            const old = previous.get(row.headword);
            yield { ...row, content: old ? alignDocument(old.content, row.content) : row.content };
          }
        }
      }
      const incoming = await store.capture(
        lineage,
        { ...datasetSnapshotMetadata(dataset), version: version ?? null, adapter },
        complete,
        aligned(),
      );
      const local = await captureCurrent(em, dataset);
      // Legacy imports receive an explicit two-way review: every differing value
      // is a conflict and no fabricated ancestor enables automatic replacement.
      const plan = await store.prepare('source', local.id, incoming.id, !baseline);
      await this.dependencies(store, em, plan.id);
      return store.summary(plan.id);
    });
  }

  async prepareParent(name: string, sourceName: string, allowTwoWay = false) {
    if (!this.datasets.supported) throw new ConflictException('datasets_not_supported');
    if (name === sourceName) throw new BadRequestException('reconciliation_same_dataset');
    this.imports.begin(ImportTriggerE.manual, `Prepare merge ${sourceName} → ${name}`, name);
    let outcome: { error?: string } = {};
    try {
      return await this.prepareParentWork(name, sourceName, allowTwoWay);
    } catch (error) {
      outcome = { error: error instanceof Error ? error.message : String(error) };
      throw error;
    } finally {
      this.imports.end(outcome);
    }
  }

  private async prepareParentWork(
    name: string,
    sourceName: string,
    allowTwoWay: boolean,
    progress?: ReconciliationProgressSinkT,
  ) {
    const destination = await this.datasets.find(name);
    const source = await this.datasets.find(sourceName);
    if (!destination.own || destination.language !== source.language)
      throw new ConflictException('reconciliation_source_incompatible');
    const connection = await this.datasets.reader(source);
    return await connection.transaction('REPEATABLE READ', async (sourceManager) => {
      // Snapshot source content on one connection. Destination storage is separate;
      // source edits after capture cannot change the pending plan.
      return this.on(name, async (store, em, dataset) => {
        const lineage = await persistentLineage(sourceManager, source);
        if (lineage === (await persistentLineage(em, dataset)))
          throw new ConflictException('reconciliation_same_dataset');
        const direct = await em.existsBy(ReconciliationBaseline, { lineage });
        const local = await captureCurrent(em, dataset, preparationStage(progress, 'local_snapshot'));
        const incoming = await captureCurrent(
          sourceManager,
          source,
          preparationStage(progress, 'incoming_snapshot'),
        );
        await copyRevisionGraph(sourceManager, em, incoming.id, preparationStage(progress, 'ancestry'));
        const baselineProgress = preparationStage(progress, 'baseline');
        if (!direct) {
          const common = await commonAncestor(store, local.id, incoming.id);
          if (common) {
            const ancestor = await store.capture(
              lineage,
              { ...common.metadata, source: source.name },
              true,
              store.records(common.id),
              [common.id],
              baselineProgress,
            );
            await store.establish(lineage, ancestor.id);
          } else if (!allowTwoWay) throw new ConflictException('reconciliation_baseline_required');
        }
        const plan = await store.prepare(
          direct ? 'parent' : 'merge',
          local.id,
          incoming.id,
          allowTwoWay,
          preparationStage(progress, 'comparing'),
        );
        await this.dependencies(store, em, plan.id, preparationStage(progress, 'dependencies'));
        preparationStage(progress, 'finalizing');
        return store.summary(plan.id);
      });
    });
  }

  private async validateOrigins(em: EntityManager, item: ReconciliationItem) {
    if (!item.result.present) return;
    const plan = await em.findOneByOrFail(ReconciliationPlan, { id: item.plan });
    this.validateOriginRecords(
      item,
      await new ReconciliationStore(em).recordsFor([plan.local, plan.incoming], [item.headword]),
    );
  }

  private validateOriginRecords(item: ReconciliationItem, records: ReconciliationRecord[]) {
    if (!item.result.present) return;
    const allowed = new Map<string, import('../../../../../types/reconciliation').ReconciliationValueT[]>();
    for (const row of records) {
      if (!row?.content) continue;
      for (const [part, raw] of Object.entries(object(object(row.content).parts))) {
        const origins = object(object(raw).common).origins;
        allowed.set(part, [...(allowed.get(part) ?? []), origins]);
      }
    }
    for (const [part, raw] of Object.entries(object(object(item.result.value).parts))) {
      const origins = object(object(raw).common).origins;
      if (!(allowed.get(part) ?? []).some((value) => equalSides(present(value), present(origins))))
        throw new ConflictException('reconciliation_origins_immutable');
    }
  }

  private async dependencies(
    store: ReconciliationStore,
    em: EntityManager,
    id: string,
    progress?: ReconciliationCounterT,
  ) {
    const graph = await ReconciliationDependencies.read(store.results(id));
    const total = progress ? await em.countBy(ReconciliationItem, { plan: id }) : undefined;
    let processed = 0;
    progress?.(processed, total);
    for await (const item of store.results(id)) {
      const targets = graph.problems(item);
      if (targets.length) {
        await store.dependency(id, item.headword, targets);
        for (const target of targets) {
          if (graph.isDeleted(target)) await store.dependency(id, target, [item.headword]);
        }
      }
      progress?.(++processed, total);
    }
  }

  private async validateGraph(
    store: ReconciliationStore,
    em: EntityManager,
    dataset: Dataset,
    plan: ReconciliationPlan,
    progress?: ReconciliationApplicationSinkT,
  ) {
    const id = plan.id;
    const advance = applicationStage(progress, 'validating');
    const total = await em.countBy(ReconciliationItem, { plan: id });
    let processed = 0;
    advance?.(processed, total);
    const graph = await ReconciliationDependencies.read(store.results(id));
    for await (const page of batches(store.items(id))) {
      const records = await store.recordsFor(
        [plan.local, plan.incoming],
        page.map((item) => item.headword),
      );
      const byHeadword = new Map<string, ReconciliationRecord[]>();
      for (const row of records) {
        const group = byHeadword.get(row.headword) ?? [];
        group.push(row);
        byHeadword.set(row.headword, group);
      }
      for (const item of page) {
        advance?.(++processed, total);
        if (!item.result.present) continue;
        validateDocument(em, item.result.value, dataset.license, !isHumanAuthoredDataset(dataset));
        this.validateOriginRecords(item, byHeadword.get(item.headword) ?? []);
        const targets = graph.problems(item);
        if (targets.length)
          throw new ConflictException({
            message: `reconciliation_reference_missing: ${item.headword} → ${targets.join(', ')}`,
            headword: item.headword,
            targets,
          });
      }
    }
  }

  private async applyWork(name: string, id: string, progress?: ReconciliationApplicationSinkT) {
    // The route bypasses counting itself in SwitchGate. Refuse to publish when a
    // request failed to drain; never use the gate's timeout as permission to race it.
    const held = await this.datasets.gate.hold(async () => {
      if (this.datasets.gate.busy) throw new ConflictException('reconciliation_readers_busy');
      return this.on(name, async (store, em, dataset) => {
        if ((await em.findOneByOrFail(ReconciliationPlan, { id })).status === 'applied')
          return store.summary(id);
        applicationStage(progress, 'locking');
        if (em.connection.options.type === 'postgres') {
          // Pin terms and identity in the same transaction as publication.
          await em
            .createQueryBuilder(Dataset, 'dataset')
            .setLock('pessimistic_write')
            .where('dataset.id = :id', { id: dataset.id })
            .getOneOrFail();
          const tables = DICTIONARY_ENTITIES.map((entity) => em.connection.getMetadata(entity));
          const all = [
            ...tables,
            ...tables.flatMap((meta) =>
              meta.ownRelations
                .filter((relation) => relation.isManyToManyOwner)
                .map((relation) => relation.junctionEntityMetadata!),
            ),
          ];
          await em.query(
            `LOCK TABLE ${all.map((meta) => em.connection.driver.escape(meta.tableName)).join(', ')} IN EXCLUSIVE MODE`,
          );
        }
        const current = await store.capture(
          await persistentLineage(em, dataset),
          datasetSnapshotMetadata(dataset),
          true,
          dictionaryRecords(em, dataset),
          [],
          applicationStage(progress, 'snapshot'),
        );
        const outcome = await store.apply(
          id,
          current.id,
          (plan) => this.validateGraph(store, em, dataset, plan, progress),
          async (plan) => {
            await withDatasetScope({ dataset, dataSource: em.connection }, () =>
              publishPlan(em, plan, dataset.license, progress),
            );
            if (plan.kind === 'source') {
              const incoming = await store.revision(plan.incoming);
              const version = typeof incoming.metadata.version === 'string' ? incoming.metadata.version : null;
              await em.update(Dataset, { id: dataset.id }, { version, imported_at: new Date() });
              if (dataset.name === this.datasets.getActive().name) {
                if (version) await em.save(Settings, { field: DATASET_VERSION_SETTINGS_FIELD, value: version });
                else await em.delete(Settings, { field: DATASET_VERSION_SETTINGS_FIELD });
              }
            }
          },
          progress,
        );
        applicationStage(progress, 'finalizing');
        await em
          .createQueryBuilder()
          .delete()
          .from(ReconciliationRecord)
          .where('revision = :id', { id: current.id })
          .execute();
        await em.delete(ReconciliationRevision, { id: current.id });
        if (!(await em.existsBy(AuditLog, { request_id: `reconciliation:${id}` })))
          await em.save(AuditLog, {
            trigger: AuditTriggerE.admin,
            action: AuditActionE.update,
            entity_type: AuditEntityTypeE.dataset,
            entity_id: dataset.id,
            dataset: name,
            request_id: `reconciliation:${id}`,
            headword: name,
            diff: { reconciliation: { before: null, after: { id, ...outcome.proposed } } },
          });
        return outcome;
      });
    });
    const dataset = await this.datasets.find(name);
    this.datasets.reconciliationCommitted(dataset);
    return held.result;
  }
}
