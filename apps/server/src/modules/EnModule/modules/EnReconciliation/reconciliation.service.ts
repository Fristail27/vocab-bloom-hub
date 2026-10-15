import { captureCurrent, commonAncestor, copyRevisionGraph } from './ancestry';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityNotFoundError, QueryFailedError } from 'typeorm';
import { DatasetsService } from '../../../DatasetsModule/datasets.service';
import { ImportStatusService } from '../EnImportDictionary/importStatus.service';
import {
  ImportTriggerE,
  AuditActionE,
  AuditEntityTypeE,
  AuditTriggerE,
  EnPartOfSpeechE,
} from '../../../../../types';
import type {
  ReconciliationCategoryT,
  ReconciliationDecisionT,
  ReconciliationSideT,
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
import { collection, object, strings, validateDocument } from './document';
import { publishPlan } from './publish';
import { contentHash, equalSides, present } from './compare';
import { alignDocument } from './snapshot';
import { ReconciliationRecord } from './entities';
import { Settings } from '../../../SettingsModule/entities/settings.entity';
import { DATASET_VERSION_SETTINGS_FIELD } from '../EnImportDictionary/constants';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly datasets: DatasetsService,
    private readonly imports: ImportStatusService,
  ) {}

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
        for await (const row of dictionaryRecords(incomingManager, { ...dataset, version: version ?? null })) {
          const old = baseline
            ? await em
                .createQueryBuilder(ReconciliationRecord, 'record')
                .where('record.revision = :revision AND record.headword = :headword', {
                  revision: baseline.revision,
                  headword: row.headword,
                })
                .getOne()
            : null;
          yield { ...row, content: old ? alignDocument(old.content, row.content) : row.content };
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
    const destination = await this.datasets.find(name);
    const source = await this.datasets.find(sourceName);
    if (!destination.own || destination.language !== source.language)
      throw new ConflictException('reconciliation_source_incompatible');
    this.imports.begin(ImportTriggerE.manual, `Prepare merge ${sourceName} → ${name}`, name);
    let outcome: { error?: string } = {};
    try {
      const connection = await this.datasets.reader(source);
      return await connection.transaction('REPEATABLE READ', async (sourceManager) => {
        // Snapshot source content on one connection. Destination storage is separate;
        // source edits after capture cannot change the pending plan.
        return this.on(name, async (store, em, dataset) => {
          const lineage = await persistentLineage(sourceManager, source);
          if (lineage === (await persistentLineage(em, dataset)))
            throw new ConflictException('reconciliation_same_dataset');
          const direct = await em.existsBy(ReconciliationBaseline, { lineage });
          const local = await captureCurrent(em, dataset);
          const incoming = await captureCurrent(sourceManager, source);
          await copyRevisionGraph(sourceManager, em, incoming.id);
          if (!direct) {
            const common = await commonAncestor(store, local.id, incoming.id);
            if (common) {
              const ancestor = await store.capture(
                lineage,
                { ...common.metadata, source: source.name },
                true,
                store.records(common.id),
                [common.id],
              );
              await store.establish(lineage, ancestor.id);
            } else if (!allowTwoWay) throw new ConflictException('reconciliation_baseline_required');
          }
          const plan = await store.prepare(direct ? 'parent' : 'merge', local.id, incoming.id, allowTwoWay);
          await this.dependencies(store, em, plan.id);
          return store.summary(plan.id);
        });
      });
    } catch (error) {
      outcome = { error: error instanceof Error ? error.message : String(error) };
      throw error;
    } finally {
      this.imports.end(outcome);
    }
  }

  private async validateOrigins(em: EntityManager, item: ReconciliationItem) {
    if (!item.result.present) return;
    const plan = await em.findOneByOrFail(ReconciliationPlan, { id: item.plan });
    const revisions = [plan.local, plan.incoming];
    const allowed = new Map<string, import('../../../../../types/reconciliation').ReconciliationValueT[]>();
    for (const revision of revisions) {
      const row = await em
        .createQueryBuilder(ReconciliationRecord, 'record')
        .where('record.revision = :revision AND record.headword = :headword', {
          revision,
          headword: item.headword,
        })
        .getOne();
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

  private async problems(
    store: ReconciliationStore,
    em: EntityManager,
    id: string,
    item: ReconciliationItem,
  ): Promise<string[]> {
    if (!item.result.present) return [];
    const article = object(item.result.value);
    const problems = new Set<string>();
    const requireTarget = async (target: string, part?: string, reciprocal?: string) => {
      const targetItem = await em.findOneBy(ReconciliationItem, { plan: id, headword: target });
      if (targetItem?.result.present) {
        const value = object(targetItem.result.value);
        if (part && !object(value.parts)[part]) problems.add(target);
        if (reciprocal && !strings(value.alternatives).includes(reciprocal)) problems.add(target);
        return;
      }
      // A form-only spelling is a valid alternative endpoint, but not a phrasal base.
      if (!part)
        for await (const other of store.items(id)) {
          if (!other.result.present) continue;
          for (const raw of Object.values(object(object(other.result.value).parts))) {
            for (const [, form] of collection(object(raw).forms))
              if (form.word === target) {
                if (reciprocal && !strings(form.alternatives ?? []).includes(reciprocal)) problems.add(target);
                return;
              }
          }
        }
      problems.add(target);
    };
    for (const target of strings(article.alternatives)) {
      if (target === item.headword) problems.add(target);
      else await requireTarget(target, undefined, item.headword);
    }
    for (const raw of Object.values(object(article.parts))) {
      const word = object(raw);
      const base = object(word.common).base_phrasal;
      if (base) {
        if (base === item.headword) problems.add(String(base));
        else {
          await requireTarget(String(base), EnPartOfSpeechE.verb);
          const seen = new Set([item.headword]);
          let next: string | undefined = String(base);
          while (next) {
            if (seen.has(next)) {
              problems.add(next);
              break;
            }
            seen.add(next);
            const target: ReconciliationItem | null = await em.findOneBy(ReconciliationItem, {
              plan: id,
              headword: next,
            });
            const verb: import('../../../../../types/reconciliation').ReconciliationValueT | undefined = target
              ?.result.present
              ? object(object(target.result.value).parts)[EnPartOfSpeechE.verb]
              : undefined;
            const link: import('../../../../../types/reconciliation').ReconciliationValueT | undefined = verb
              ? object(object(verb).common).base_phrasal
              : undefined;
            next = typeof link === 'string' && link ? link : undefined;
          }
        }
      }
      for (const [, form] of collection(word.forms))
        for (const target of strings(form.alternatives ?? [])) {
          if (target === form.word) problems.add(target);
          else await requireTarget(target, undefined, String(form.word));
        }
      for (const [, meaning] of collection(word.meanings))
        for (const target of [...strings(meaning.synonyms), ...strings(meaning.antonyms)]) {
          if (target === item.headword) problems.add(target);
          else await requireTarget(target);
        }
    }
    return [...problems];
  }

  private async dependencies(store: ReconciliationStore, em: EntityManager, id: string) {
    for await (const item of store.items(id)) {
      const targets = await this.problems(store, em, id, item);
      if (targets.length) {
        await store.dependency(id, item.headword, targets);
        for (const target of targets) {
          const deleted = await em.findOneBy(ReconciliationItem, { plan: id, headword: target });
          if (deleted && !deleted.result.present) await store.dependency(id, target, [item.headword]);
        }
      }
    }
  }

  private async validateGraph(store: ReconciliationStore, em: EntityManager, dataset: Dataset, id: string) {
    for await (const item of store.items(id)) {
      if (!item.result.present) continue;
      validateDocument(em, item.result.value, dataset.license, !isHumanAuthoredDataset(dataset));
      await this.validateOrigins(em, item);
      const targets = await this.problems(store, em, id, item);
      if (targets.length)
        throw new ConflictException({
          message: `reconciliation_reference_missing: ${item.headword} → ${targets.join(', ')}`,
          headword: item.headword,
          targets,
        });
    }
  }

  async apply(name: string, id: string) {
    this.imports.begin(ImportTriggerE.manual, `Apply merge ${id}`, name);
    let outcome: { error?: string } = {};
    try {
      // The route bypasses counting itself in SwitchGate. Refuse to publish when a
      // request failed to drain; never use the gate's timeout as permission to race it.
      const held = await this.datasets.gate.hold(async () => {
        if (this.datasets.gate.busy) throw new ConflictException('reconciliation_readers_busy');
        return this.on(name, async (store, em, dataset) => {
          if ((await em.findOneByOrFail(ReconciliationPlan, { id })).status === 'applied')
            return store.summary(id);
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
          );
          const outcome = await store.apply(
            id,
            current.id,
            () => this.validateGraph(store, em, dataset, id),
            async (plan) => {
              await withDatasetScope({ dataset, dataSource: em.connection }, () =>
                publishPlan(em, plan, dataset.license),
              );
              if (plan.kind === 'source') {
                const incoming = await store.revision(plan.incoming);
                const version =
                  typeof incoming.metadata.version === 'string' ? incoming.metadata.version : null;
                await em.update(Dataset, { id: dataset.id }, { version, imported_at: new Date() });
                if (dataset.name === this.datasets.getActive().name) {
                  if (version)
                    await em.save(Settings, { field: DATASET_VERSION_SETTINGS_FIELD, value: version });
                  else await em.delete(Settings, { field: DATASET_VERSION_SETTINGS_FIELD });
                }
              }
            },
          );
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
    } catch (error) {
      outcome = { error: error instanceof Error ? error.message : String(error) };
      throw error;
    } finally {
      this.imports.end(outcome);
    }
  }
}
