import { redactSnapshotAuthor } from '../history';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { exportSynchronization, importSynchronization } from '../archive';
import { RECONCILIATION_ENTITIES, ReconciliationIdentity, ReconciliationPlan } from '../entities';
import { ReconciliationStore, SnapshotRecordT } from '../store';

async function* records(value: string): AsyncGenerator<SnapshotRecordT> {
  yield { headword: 'word', content: { definition: value } };
  yield { headword: 'deleted', content: null, history: [] };
}

describe('portable synchronization archive', () => {
  let source: DataSource;
  let target: DataSource;
  let dir: string;
  beforeEach(async () => {
    source = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: RECONCILIATION_ENTITIES,
      synchronize: true,
    }).initialize();
    target = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: RECONCILIATION_ENTITIES,
      synchronize: true,
    }).initialize();
    dir = await mkdtemp(join(tmpdir(), 'vbh-merge-archive-'));
  });
  afterEach(async () => {
    await source.destroy();
    await target.destroy();
    await rm(dir, { recursive: true, force: true });
  });

  async function prepare() {
    return source.transaction(async (em) => {
      const store = new ReconciliationStore(em);
      await em.insert(ReconciliationIdentity, { key: 'self', lineage: 'portable-dataset' });
      const base = await store.capture('parent', { source: 'parent' }, true, records('base'));
      await store.establish('parent', base.id);
      const local = await store.capture('local', { source: 'local' }, true, records('local'));
      const incoming = await store.capture('parent', { source: 'parent' }, true, records('incoming'));
      const plan = await store.prepare('parent', local.id, incoming.id);
      await store.decide(plan.id, 'word', 0, [{ path: ['definition'], choice: 'local' }]);
      await store.apply(
        plan.id,
        local.id,
        async () => {},
        async () => {},
      );
      await store.prepare('parent', local.id, incoming.id);
      return { id: plan.id, incoming: incoming.id, local: local.id };
    });
  }

  it('roundtrips identities, baselines, tombstones and no-op decisions, excluding pending reviews', async () => {
    const plan = await prepare();
    const file = join(dir, 'sync.jsonl');
    await source.transaction((em) => exportSynchronization(em, file));
    await target.transaction((em) => importSynchronization(em, file));
    expect(await target.manager.count(ReconciliationPlan)).toBe(1);
    expect((await target.manager.findOneByOrFail(ReconciliationIdentity, { key: 'self' })).lineage).toBe(
      'portable-dataset',
    );
    const store = new ReconciliationStore(target.manager);
    expect((await store.summary(plan.id)).proposed).toEqual({ added: 0, deleted: 0, changed: 0 });
    const item = (await store.list(plan.id)).items.find((row) => row.headword === 'word')!;
    expect(item.decisions).toEqual([{ path: ['definition'], choice: 'local' }]);
    await target.transaction(async (em) => {
      const restored = new ReconciliationStore(em);
      const repeated = await restored.prepare('parent', plan.local, plan.incoming);
      expect((await restored.summary(repeated.id)).remaining_conflicts).toBe(0);
    });
  });

  it('rejects tampered snapshots atomically and leaves the target available for a corrected import', async () => {
    await prepare();
    const file = join(dir, 'sync.jsonl');
    await source.transaction((em) => exportSynchronization(em, file));
    const original = await readFile(file, 'utf8');
    await writeFile(file, original.replace('"definition":"base"', '"definition":"tampered"'));
    await expect(target.transaction((em) => importSynchronization(em, file))).rejects.toThrow(
      'archive_invalid',
    );
    expect(await target.manager.count(ReconciliationIdentity)).toBe(0);
    await writeFile(file, original);
    await target.transaction((em) => importSynchronization(em, file));
    await expect(target.transaction((em) => importSynchronization(em, file))).rejects.toThrow('requires_empty');
  });
  it('redacts an author from retained snapshots and exports hashes matching the redacted history', async () => {
    await source.transaction(async (em) => {
      async function* named(): AsyncGenerator<SnapshotRecordT> {
        yield {
          headword: 'word',
          content: { definition: 'text' },
          history: [
            {
              headword: 'word',
              part_of_speech: 'noun',
              entity: 'word',
              action: 'update',
              created_at: '2026-10-01T00:00:00.000Z',
              origin: 'admin',
              author: 'Ada',
              record: null,
              diff: { definition: { before: 'before', after: 'text' } },
              superseded_at: null,
            },
          ],
        };
      }
      await new ReconciliationStore(em).capture('source', { source: 'source' }, true, named());
      await redactSnapshotAuthor(em, 'Ada');
    });
    const file = join(dir, 'redacted.jsonl');
    await source.transaction((em) => exportSynchronization(em, file));
    expect(await readFile(file, 'utf8')).not.toContain('Ada');
    await target.transaction((em) => importSynchronization(em, file));
  });
});
