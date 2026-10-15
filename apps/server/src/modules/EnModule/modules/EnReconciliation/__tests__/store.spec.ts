import { DataSource } from 'typeorm';
import {
  RECONCILIATION_ENTITIES,
  ReconciliationBaseline,
  ReconciliationItem,
  ReconciliationPlan,
  ReconciliationRevision,
} from '../entities';
import { ReconciliationStore, SnapshotRecordT } from '../store';

async function* rows(values: Record<string, string>): AsyncGenerator<SnapshotRecordT> {
  for (const [headword, definition] of Object.entries(values)) yield { headword, content: { definition } };
}

describe('durable reconciliation plans', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: RECONCILIATION_ENTITIES,
      synchronize: true,
    }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });

  const capture = (
    store: ReconciliationStore,
    values: Record<string, string>,
    lineage = 'source',
    complete = true,
  ) => store.capture(lineage, { source: lineage }, complete, rows(values));

  async function setup() {
    return db.transaction(async (em) => {
      const store = new ReconciliationStore(em);
      const baseline = await capture(store, {
        conflict: 'base',
        deleted: 'base',
        local_deleted: 'base',
        changed: 'base',
      });
      await store.establish('source', baseline.id);
      const local = await capture(store, { conflict: 'local', deleted: 'base', changed: 'base' }, 'local');
      const incoming = await capture(store, {
        conflict: 'incoming',
        added: 'new',
        local_deleted: 'base',
        changed: 'new',
      });
      const plan = await store.prepare('source', local.id, incoming.id);
      return { plan, local, incoming, baseline };
    });
  }

  it('persists review, stable counts and decisions between service instances', async () => {
    const { plan } = await setup();
    expect(await new ReconciliationStore(db.manager).summary(plan.id)).toMatchObject({
      counts: { added: 1, deleted: 1, changed: 1, conflicts: 1, local_only: 1, unchanged: 0 },
      remaining_conflicts: 1,
    });
    await db.transaction(async (em) => {
      await new ReconciliationStore(em).decide(plan.id, 'conflict', 0, [
        { path: ['definition'], choice: 'local' },
      ]);
    });
    const summary = await new ReconciliationStore(db.manager).summary(plan.id);
    expect(summary).toMatchObject({
      resolved_articles: 1,
      remaining_conflicts: 0,
      proposed: { added: 1, deleted: 1, changed: 1 },
    });
    expect(summary.counts.conflicts).toBe(1);
    await expect(
      db.transaction((em) => new ReconciliationStore(em).decide(plan.id, 'conflict', 0, [])),
    ).rejects.toThrow('outdated');
  });

  it('applies once, retains a no-op resolution and advances the incoming baseline', async () => {
    const { plan, local, incoming } = await setup();
    const publish = jest.fn(async () => {});
    await db.transaction(async (em) => {
      const store = new ReconciliationStore(em);
      await store.decide(plan.id, 'conflict', 0, [{ path: ['definition'], choice: 'local' }]);
      expect((await store.apply(plan.id, local.id, async () => {}, publish)).status).toBe('applied');
    });
    await db.transaction((em) => new ReconciliationStore(em).apply(plan.id, local.id, async () => {}, publish));
    expect(publish).toHaveBeenCalledTimes(1);
    expect(await db.manager.findOneByOrFail(ReconciliationBaseline, { lineage: 'source' })).toMatchObject({
      revision: incoming.id,
    });
    expect(
      await db.manager.findOneByOrFail(ReconciliationItem, { plan: plan.id, headword: 'conflict' }),
    ).toMatchObject({ decisions: [{ path: ['definition'], choice: 'local' }] });
  });

  it('rejects unresolved conflicts, changed destination and another integrated revision', async () => {
    const { plan, local } = await setup();
    const publish = jest.fn(async () => {});
    await expect(
      db.transaction((em) => new ReconciliationStore(em).apply(plan.id, local.id, async () => {}, publish)),
    ).rejects.toThrow('unresolved');
    await db.transaction((em) =>
      new ReconciliationStore(em).decide(plan.id, 'conflict', 0, [
        { path: ['definition'], choice: 'incoming' },
      ]),
    );
    await expect(
      db.transaction(async (em) => {
        const store = new ReconciliationStore(em);
        const current = await capture(
          store,
          { conflict: 'edited later', deleted: 'base', changed: 'base' },
          'local',
        );
        return store.apply(plan.id, current.id, async () => {}, publish);
      }),
    ).rejects.toThrow('stale');
    await db.manager.update(ReconciliationBaseline, { lineage: 'source' }, { revision: 'another' });
    await expect(
      db.transaction((em) => new ReconciliationStore(em).apply(plan.id, local.id, async () => {}, publish)),
    ).rejects.toThrow('stale');
    expect(publish).not.toHaveBeenCalled();
  });

  it('rolls publication and baseline changes back together on failure and permits retry', async () => {
    const { plan, local, baseline } = await setup();
    await db.transaction((em) =>
      new ReconciliationStore(em).decide(plan.id, 'conflict', 0, [
        { path: ['definition'], choice: 'incoming' },
      ]),
    );
    await expect(
      db.transaction((em) =>
        new ReconciliationStore(em).apply(
          plan.id,
          local.id,
          async () => {},
          async () => {
            await em.update(
              ReconciliationPlan,
              { id: plan.id },
              { outcome: { added: 99, deleted: 0, changed: 0 } },
            );
            throw new Error('disk full');
          },
        ),
      ),
    ).rejects.toThrow('disk full');
    expect(await db.manager.findOneByOrFail(ReconciliationPlan, { id: plan.id })).toMatchObject({
      status: 'review',
      outcome: null,
    });
    expect(await db.manager.findOneByOrFail(ReconciliationBaseline, { lineage: 'source' })).toMatchObject({
      revision: baseline.id,
    });
    await db.transaction((em) =>
      new ReconciliationStore(em).apply(
        plan.id,
        local.id,
        async () => {},
        async () => {},
      ),
    );
  });

  it('preserves baseline records outside a partial import and detects their later deletion', async () => {
    await db.transaction(async (em) => {
      const store = new ReconciliationStore(em);
      const baseline = await capture(store, { kept: 'original', updated: 'old' });
      await store.establish('source', baseline.id);
      const local = await capture(store, { kept: 'local edit', updated: 'old' }, 'local');
      const incoming = await capture(store, { updated: 'new' }, 'source', false);
      const plan = await store.prepare('source', local.id, incoming.id);
      await store.apply(
        plan.id,
        local.id,
        async () => {},
        async () => {},
      );
      const nextLocal = await capture(store, { kept: 'local edit', updated: 'new' }, 'local');
      const nextIncoming = await capture(store, { updated: 'new' });
      const next = await store.prepare('source', nextLocal.id, nextIncoming.id);
      const item = await em.findOneByOrFail(ReconciliationItem, { plan: next.id, headword: 'kept' });
      expect(item.comparison.conflicts[0].kind).toBe('delete');
    });
  });

  it('requires explicit two-way review for legacy data and forbids editing cancelled plans', async () => {
    await db.transaction(async (em) => {
      const store = new ReconciliationStore(em);
      const local = await capture(store, { word: 'local' }, 'local');
      const incoming = await capture(store, { word: 'source' });
      await expect(store.prepare('source', local.id, incoming.id)).rejects.toThrow('baseline_required');
      const plan = await store.prepare('source', local.id, incoming.id, true);
      expect((await store.summary(plan.id)).remaining_conflicts).toBe(1);
      await store.cancel(plan.id);
      await expect(store.decide(plan.id, 'word', 0, [])).rejects.toThrow('not_reviewable');
    });
  });

  it('does not leave a partially captured revision after duplicate or interrupted input', async () => {
    async function* duplicate() {
      yield { headword: 'a', content: 'one' };
      yield { headword: 'a', content: 'two' };
    }
    await expect(
      db.transaction((em) => new ReconciliationStore(em).capture('source', {}, true, duplicate())),
    ).rejects.toThrow();
    expect(await db.manager.count(ReconciliationRevision)).toBe(0);
  });

  it('paginates and treats search wildcards literally', async () => {
    const { plan } = await setup();
    const store = new ReconciliationStore(db.manager);
    expect((await store.list(plan.id, 1, 'conflicts')).items.map((item) => item.headword)).toEqual([
      'conflict',
    ]);
    expect((await store.list(plan.id, 1, undefined, '%')).total).toBe(0);
  });
  it('aggregates counts without loading article JSON, independently of dictionary size', async () => {
    const { plan } = await setup();
    const query = jest.spyOn(db.logger, 'logQuery').mockImplementation(() => {});
    try {
      const store = new ReconciliationStore(db.manager);
      const summary = await store.summary(plan.id);
      expect(summary.proposed).toEqual({ added: 1, deleted: 1, changed: 1 });
      expect(query.mock.calls.length).toBeLessThanOrEqual(3);
      expect(query.mock.calls.every(([sql]) => !sql.includes('reconciliation_records'))).toBe(true);
      await db.transaction((em) =>
        new ReconciliationStore(em).decide(plan.id, 'conflict', 0, [
          { path: ['definition'], choice: 'incoming' },
        ]),
      );
      expect((await store.summary(plan.id)).proposed.changed).toBe(2);
    } finally {
      query.mockRestore();
    }
  });
});
