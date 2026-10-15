import { randomUUID } from 'node:crypto';
import { EntityManager, MoreThan } from 'typeorm';
import type {
  ReconciliationCategoryT,
  ReconciliationDecisionT,
  ReconciliationKindT,
  ReconciliationSideT,
  ReconciliationSummaryT,
  ReconciliationValueT,
} from '../../../../../types/reconciliation';
import { overlayPartial } from './compare';
import { compare, contentHash, equalSides, missing, present, resolve } from './compare';
import {
  ReconciliationIdentity,
  ReconciliationBaseline,
  ReconciliationItem,
  ReconciliationPlan,
  ReconciliationRecord,
  ReconciliationRevision,
} from './entities';

const PAGE = 100;
export const effectOf = (
  local: ReconciliationSideT,
  result: ReconciliationSideT,
): ReconciliationItem['effect'] =>
  equalSides(local, result) ? null : !local.present ? 'added' : !result.present ? 'deleted' : 'changed';
export type SnapshotRecordT = {
  headword: string;
  content: ReconciliationValueT;
  history?: ReconciliationRecord['history'];
  versions?: Record<string, string>;
};

/**
 * All methods use the caller's manager. Snapshot capture/preparation and application
 * must run inside transactions; a failure publishes neither incomplete revisions nor plans.
 * Live dictionary writes belong to the adapter passed to apply, in the same transaction.
 */
export class ReconciliationStore {
  constructor(private readonly em: EntityManager) {}

  private transaction(): void {
    if (!this.em.queryRunner?.isTransactionActive) throw new Error('reconciliation_transaction_required');
  }

  async capture(
    lineage: string,
    metadata: Record<string, ReconciliationValueT>,
    complete: boolean,
    records: AsyncIterable<SnapshotRecordT>,
    parents: string[] = [],
  ): Promise<ReconciliationRevision> {
    this.transaction();
    const revision = this.em.create(ReconciliationRevision, {
      id: randomUUID(),
      parents: [...new Set(parents)],
      lineage,
      metadata,
      complete,
      sealed: false,
    });
    await this.em.insert(ReconciliationRevision, revision);
    for await (const row of records) {
      // Duplicate headwords fail the primary key, rather than silently overwriting input.
      await this.em
        .createQueryBuilder()
        .insert()
        .into('reconciliation_records')
        .values({
          revision: revision.id,
          headword: row.headword,
          content: row.content,
          hash: contentHash(
            JSON.parse(
              JSON.stringify({
                content: row.content,
                history: row.history ?? [],
                versions: row.versions ?? {},
              }),
            ),
          ),
          history: row.history ?? [],
          versions: row.versions ?? {},
        })
        .execute();
    }
    await this.em.update(ReconciliationRevision, { id: revision.id }, { sealed: true });
    revision.sealed = true;
    return revision;
  }

  async revision(id: string): Promise<ReconciliationRevision> {
    const row = await this.em.findOneBy(ReconciliationRevision, { id, sealed: true });
    if (!row) throw new Error('reconciliation_revision_missing');
    return row;
  }

  /** Explicit baseline establishment. The caller verifies provenance/common ancestry. */
  async establish(lineage: string, revision: string): Promise<void> {
    this.transaction();
    const snapshot = await this.revision(revision);
    if (snapshot.lineage !== lineage) throw new Error('reconciliation_lineage_mismatch');
    if (await this.em.existsBy(ReconciliationBaseline, { lineage }))
      throw new Error('reconciliation_baseline_exists');
    await this.em.insert(ReconciliationBaseline, { lineage, revision });
  }

  record(revision: string, headword: string): Promise<ReconciliationRecord | null> {
    return this.em
      .createQueryBuilder(ReconciliationRecord, 'record')
      .where('record.revision = :revision AND record.headword = :headword', { revision, headword })
      .getOne();
  }

  async side(revision: string | null, headword: string): Promise<ReconciliationSideT> {
    if (!revision) return missing;
    const row = await this.record(revision, headword);
    return row && row.content !== null ? present(row.content) : missing;
  }

  async *records(revision: string): AsyncGenerator<ReconciliationRecord> {
    let cursor: string | undefined;
    for (;;) {
      const page = await this.em.find(ReconciliationRecord, {
        where: { revision, ...(cursor !== undefined && { headword: MoreThan(cursor) }) },
        order: { headword: 'ASC' },
        take: PAGE,
      });
      if (!page.length) return;
      for (const row of page) yield row;
      cursor = page[page.length - 1].headword;
    }
  }

  async prepare(
    kind: ReconciliationKindT,
    local: string,
    incoming: string,
    allowTwoWay = false,
  ): Promise<ReconciliationPlan> {
    this.transaction();
    const source = await this.revision(incoming);
    const destination = await this.revision(local);
    if (!destination.complete) throw new Error('reconciliation_local_snapshot_incomplete');
    const baseline = await this.em.findOneBy(ReconciliationBaseline, { lineage: source.lineage });
    if (!baseline && !allowTwoWay) throw new Error('reconciliation_baseline_required');
    if (baseline) await this.revision(baseline.revision);
    const plan = this.em.create(ReconciliationPlan, {
      id: randomUUID(),
      kind,
      status: 'preparing',
      lineage: source.lineage,
      baseline: baseline?.revision ?? null,
      local,
      incoming,
      created_at: new Date().toISOString(),
      applied_at: null,
      outcome: null,
    });
    await this.em.insert(ReconciliationPlan, plan);
    // Walk the union on disk. Each article is compared exactly once, including
    // tombstones (present only in the baseline). Memory is bounded to one article.
    for (const revision of [local, incoming, ...(plan.baseline ? [plan.baseline] : [])]) {
      for await (const row of this.records(revision)) {
        if (await this.em.existsBy(ReconciliationItem, { plan: plan.id, headword: row.headword })) continue;
        const localSide = await this.side(local, row.headword);
        const comparison = compare(
          await this.side(plan.baseline, row.headword),
          localSide,
          await this.side(incoming, row.headword),
          { baselineKnown: Boolean(baseline), complete: source.complete },
        );
        await this.em.insert(ReconciliationItem, {
          plan: plan.id,
          headword: row.headword,
          category: comparison.category,
          effect: effectOf(localSide, comparison.result),
          comparison,
          decisions: [],
          result: comparison.result,
          remaining: comparison.conflicts.length,
          version: 0,
        });
      }
    }
    await this.em.update(ReconciliationPlan, { id: plan.id }, { status: 'review' });
    plan.status = 'review';
    return plan;
  }

  /** A row write serializes decisions/cancel/apply across processes, not just one Node instance. */
  private async lockReview(id: string): Promise<ReconciliationPlan> {
    this.transaction();
    const locked = await this.em.update(ReconciliationPlan, { id, status: 'review' }, { status: 'review' });
    if (locked.affected !== 1) throw new Error('reconciliation_plan_not_reviewable');
    return this.em.findOneByOrFail(ReconciliationPlan, { id });
  }

  async decide(
    id: string,
    headword: string,
    version: number,
    decisions: ReconciliationDecisionT[],
  ): Promise<ReconciliationItem> {
    const plan = await this.lockReview(id);
    const item = await this.em.findOneByOrFail(ReconciliationItem, { plan: id, headword });
    if (item.version !== version) throw new Error('reconciliation_decision_outdated');
    const resolved = resolve(item.comparison, decisions);
    await this.em.update(
      ReconciliationItem,
      { plan: id, headword, version },
      {
        decisions,
        result: resolved.result,
        effect: effectOf(await this.side(plan.local, headword), resolved.result),
        remaining: resolved.remaining,
        version: version + 1,
      },
    );
    return this.em.findOneByOrFail(ReconciliationItem, { plan: id, headword });
  }

  async cancel(id: string): Promise<void> {
    await this.lockReview(id);
    await this.em.update(ReconciliationPlan, { id }, { status: 'cancelled' });
  }

  /** Explicitly edit the whole result, for ambiguous identities or dependency fixes. */
  async override(
    id: string,
    headword: string,
    version: number,
    result: ReconciliationSideT,
  ): Promise<ReconciliationItem> {
    const plan = await this.lockReview(id);
    const item = await this.em.findOneByOrFail(ReconciliationItem, { plan: id, headword });
    if (item.version !== version) throw new Error('reconciliation_decision_outdated');
    const comparison = {
      category: item.category,
      result: item.result,
      conflicts: [
        {
          path: [],
          baseline: await this.side(plan.baseline, headword),
          local: await this.side(plan.local, headword),
          incoming: await this.side(plan.incoming, headword),
          kind: 'edit' as const,
        },
      ],
    };
    const conflict = comparison.conflicts[0];
    const choice = equalSides(result, conflict.local)
      ? 'local'
      : equalSides(result, conflict.incoming)
        ? 'incoming'
        : 'custom';
    const decisions: ReconciliationDecisionT[] = [{ path: [], choice, ...(choice === 'custom' && { result }) }];
    const resolved = resolve(comparison, decisions);
    await this.em.update(
      ReconciliationItem,
      { plan: id, headword },
      {
        comparison,
        decisions,
        result: resolved.result,
        effect: effectOf(conflict.local, resolved.result),
        remaining: 0,
        version: version + 1,
      },
    );
    return this.em.findOneByOrFail(ReconciliationItem, { plan: id, headword });
  }

  async list(id: string, page = 1, category?: ReconciliationCategoryT, search?: string) {
    if (!Number.isInteger(page) || page < 1) throw new Error('reconciliation_page_invalid');
    const qb = this.em.createQueryBuilder(ReconciliationItem, 'item').where('item.plan = :id', { id });
    if (category) qb.andWhere('item.category = :category', { category });
    if (search)
      qb.andWhere("LOWER(item.headword) LIKE :search ESCAPE '\\'", {
        search: `${search.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`,
      });
    const [items, total] = await qb
      .orderBy('item.headword', 'ASC')
      .skip((page - 1) * 25)
      .take(25)
      .getManyAndCount();
    const plan = await this.em.findOneByOrFail(ReconciliationPlan, { id });
    const detailed = [];
    for (const item of items)
      detailed.push({
        ...item,
        baseline: await this.side(plan.baseline, item.headword),
        local: await this.side(plan.local, item.headword),
        incoming: await this.side(plan.incoming, item.headword),
      });
    return { items: detailed, total, page, limit: 25 };
  }

  async *items(id: string): AsyncGenerator<ReconciliationItem> {
    let cursor: string | undefined;
    for (;;) {
      const page = await this.em.find(ReconciliationItem, {
        where: { plan: id, ...(cursor !== undefined && { headword: MoreThan(cursor) }) },
        order: { headword: 'ASC' },
        take: PAGE,
      });
      if (!page.length) return;
      for (const item of page) yield item;
      cursor = page[page.length - 1].headword;
    }
  }

  async summary(id: string): Promise<ReconciliationSummaryT> {
    const plan = await this.em.findOneByOrFail(ReconciliationPlan, { id });
    const source = await this.revision(plan.incoming);
    const summary: ReconciliationSummaryT = {
      id,
      kind: plan.kind,
      status: plan.status,
      source: String(source.metadata.source ?? plan.lineage),
      incoming_revision: source.id,
      incoming_complete: source.complete,
      baseline_available: plan.baseline !== null,
      created_at: plan.created_at,
      counts: { added: 0, deleted: 0, changed: 0, conflicts: 0, local_only: 0, unchanged: 0 },
      resolved_articles: 0,
      remaining_conflicts: 0,
      proposed: { added: 0, deleted: 0, changed: 0 },
    };
    const groups = await this.em
      .createQueryBuilder(ReconciliationItem, 'item')
      .select('item.category', 'category')
      .addSelect('item.effect', 'effect')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(item.remaining)', 'remaining')
      .addSelect('SUM(CASE WHEN item.remaining = 0 THEN 1 ELSE 0 END)', 'resolved')
      .where('item.plan = :id', { id })
      .groupBy('item.category')
      .addGroupBy('item.effect')
      .getRawMany<{
        category: ReconciliationCategoryT;
        effect: ReconciliationItem['effect'];
        count: string;
        remaining: string;
        resolved: string;
      }>();
    for (const group of groups) {
      summary.counts[group.category] += Number(group.count);
      summary.remaining_conflicts += Number(group.remaining);
      if (group.category === 'conflicts') summary.resolved_articles += Number(group.resolved);
      if (group.effect) summary.proposed[group.effect] += Number(group.count);
    }
    if (plan.outcome) summary.proposed = plan.outcome;
    return summary;
  }

  /**
   * Caller locks dictionary writes BEFORE capturing current and keeps that lock until
   * commit. validate checks the whole proposed graph; publish uses this same manager.
   * Operation/history/baseline writes roll back together if either callback fails.
   */
  async apply(
    id: string,
    current: string,
    validate: (plan: ReconciliationPlan) => Promise<void>,
    publish: (plan: ReconciliationPlan, items: AsyncIterable<ReconciliationItem>) => Promise<void>,
  ): Promise<ReconciliationSummaryT> {
    this.transaction();
    const already = await this.em.findOneByOrFail(ReconciliationPlan, { id });
    if (already.status === 'applied') return this.summary(id);
    const plan = await this.lockReview(id);
    const baseline = await this.em.findOneBy(ReconciliationBaseline, { lineage: plan.lineage });
    if ((baseline?.revision ?? null) !== plan.baseline) throw new Error('reconciliation_plan_stale');
    await this.assertSameSnapshot(plan.local, current);
    const summary = await this.summary(id);
    if (summary.remaining_conflicts) throw new Error('reconciliation_conflicts_unresolved');
    await validate(plan);
    await publish(plan, this.items(id));
    const source = await this.revision(plan.incoming);
    let integrated = plan.incoming;
    // A partial import advances only covered records; absent records retain their
    // previous incoming baseline, so a later complete update can detect deletions.
    if (!source.complete && plan.baseline) {
      const records = this.records.bind(this);
      const lookup = this.record.bind(this);
      async function* combined(): AsyncGenerator<SnapshotRecordT> {
        for await (const record of records(plan.baseline!)) {
          if (!(await lookup(plan.incoming, record.headword))) yield record;
        }
        for await (const record of records(plan.incoming)) {
          const previous = await lookup(plan.baseline!, record.headword);
          yield {
            ...record,
            content:
              record.content === null
                ? (previous?.content ?? null)
                : overlayPartial(previous?.content ?? null, record.content),
            history: [
              ...new Map(
                [...(previous?.history ?? []), ...record.history].map((line) => [JSON.stringify(line), line]),
              ).values(),
            ],
            versions: { ...previous?.versions, ...record.versions },
          };
        }
      }
      integrated = (await this.capture(source.lineage, source.metadata, false, combined())).id;
    }
    await this.em.upsert(ReconciliationBaseline, { lineage: plan.lineage, revision: integrated }, ['lineage']);
    await this.em.update(
      ReconciliationPlan,
      { id },
      {
        status: 'applied',
        applied_at: new Date().toISOString(),
        outcome: summary.proposed,
      },
    );
    await this.em.update(ReconciliationIdentity, { key: 'self' }, { heads: [plan.local, plan.incoming] });
    return { ...summary, status: 'applied' };
  }

  async sameRecords(left: string, other: ReconciliationStore, right: string): Promise<boolean> {
    const l = this.records(left)[Symbol.asyncIterator]();
    const r = other.records(right)[Symbol.asyncIterator]();
    for (;;) {
      const a = await l.next();
      const b = await r.next();
      if (a.done || b.done) return Boolean(a.done && b.done);
      if (a.value.headword !== b.value.headword || a.value.hash !== b.value.hash) return false;
    }
  }

  async dependency(id: string, headword: string, targets: string[]): Promise<void> {
    const plan = await this.lockReview(id);
    const item = await this.em.findOneByOrFail(ReconciliationItem, { plan: id, headword });
    // One whole-article conflict lets the reviewer repair several dependent fields together.
    if (item.comparison.conflicts.some((conflict) => conflict.kind === 'dependency')) return;
    const comparison = {
      category: 'conflicts' as const,
      result: item.result,
      conflicts: [
        {
          path: [],
          baseline: await this.side(plan.baseline, headword),
          local: await this.side(plan.local, headword),
          incoming: await this.side(plan.incoming, headword),
          kind: 'dependency' as const,
          targets,
        },
      ],
    };
    await this.em.update(
      ReconciliationItem,
      { plan: id, headword },
      { category: 'conflicts', comparison, decisions: [], remaining: 1, version: item.version + 1 },
    );
  }

  private async assertSameSnapshot(expected: string, current: string): Promise<void> {
    const before = await this.revision(expected);
    const after = await this.revision(current);
    if (
      !after.complete ||
      before.lineage !== after.lineage ||
      contentHash(before.metadata) !== contentHash(after.metadata)
    ) {
      throw new Error('reconciliation_plan_stale');
    }
    if (
      (await this.em
        .createQueryBuilder(ReconciliationRecord, 'record')
        .where('record.revision = :revision', { revision: expected })
        .getCount()) !==
      (await this.em
        .createQueryBuilder(ReconciliationRecord, 'record')
        .where('record.revision = :revision', { revision: current })
        .getCount())
    ) {
      throw new Error('reconciliation_plan_stale');
    }
    for await (const row of this.records(expected)) {
      const now = await this.record(current, row.headword);
      if (!now || now.hash !== row.hash) throw new Error('reconciliation_plan_stale');
    }
  }
}
