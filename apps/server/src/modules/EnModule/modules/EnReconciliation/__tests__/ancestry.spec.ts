import { DataSource } from 'typeorm';
import { commonAncestor, copyRevisionGraph } from '../ancestry';
import { redactSnapshotAuthor } from '../history';
import { RECONCILIATION_ENTITIES, ReconciliationRevision } from '../entities';
import { ReconciliationStore, SnapshotRecordT } from '../store';

async function* rows(value: string, author?: string): AsyncGenerator<SnapshotRecordT> {
  yield {
    headword: 'word',
    content: { description: value },
    history: author
      ? [
          {
            headword: 'word',
            part_of_speech: 'noun',
            entity: 'word',
            action: 'update',
            created_at: '2026-10-01T00:00:00.000Z',
            origin: 'admin',
            author,
            record: null,
            diff: { description: { before: 'before', after: value } },
            superseded_at: null,
          },
        ]
      : [],
  };
}

describe('causal merge ancestry', () => {
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

  it('requires manual review for incomparable common ancestors, rather than choosing an ID', async () => {
    await db.transaction(async (em) => {
      const store = new ReconciliationStore(em);
      const a = await store.capture('a', {}, true, rows('a'));
      const b = await store.capture('b', {}, true, rows('b'));
      const left = await store.capture('left', {}, true, rows('left'), [a.id, b.id]);
      const right = await store.capture('right', {}, true, rows('right'), [b.id, a.id]);
      expect(await commonAncestor(store, left.id, right.id)).toBeNull();
    });
  });

  it('ignores shared stored input that has not been integrated into either local history', async () => {
    await db.transaction(async (em) => {
      const store = new ReconciliationStore(em);
      await store.capture('pending', {}, true, rows('a shared preview'));
      const left = await store.capture('left', {}, true, rows('left'));
      const right = await store.capture('right', {}, true, rows('right'));
      expect(await commonAncestor(store, left.id, right.id)).toBeNull();
    });
  });

  it('copies reachable parents and refuses colliding snapshots with different content', async () => {
    const target = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: RECONCILIATION_ENTITIES,
      synchronize: true,
    }).initialize();
    try {
      await db.transaction(async (em) => {
        const store = new ReconciliationStore(em);
        const base = await store.capture('parent', {}, true, rows('base', 'Ada'));
        const next = await store.capture('parent', {}, true, rows('next'), [base.id]);
        await target.transaction((other) => copyRevisionGraph(em, other, next.id));
        expect((await target.manager.findOneByOrFail(ReconciliationRevision, { id: next.id })).parents).toEqual(
          [base.id],
        );
        await target.transaction((other) => redactSnapshotAuthor(other, 'Ada'));
        await target.transaction((other) => copyRevisionGraph(em, other, next.id));
        expect(
          (await new ReconciliationStore(target.manager).record(base.id, 'word'))!.history[0].author,
        ).toBeNull();
        await target.manager.update(ReconciliationRevision, next.id, { metadata: { source: 'tampered' } });
        await expect(target.transaction((other) => copyRevisionGraph(em, other, next.id))).rejects.toThrow(
          'revision_mismatch',
        );
      });
    } finally {
      await target.destroy();
    }
  });
});
