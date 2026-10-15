import { EntityManager } from 'typeorm';
import { Dataset } from '../../../DatasetsModule/entities/dataset.entity';
import { ReconciliationIdentity, ReconciliationRevision } from './entities';
import { ReconciliationStore } from './store';
import { dictionaryRecords, datasetSnapshotMetadata, persistentLineage } from './snapshot';
import { contentHash } from './compare';

/** Privacy redaction may remove an author independently in either copy of a snapshot. */
async function sameInheritedRecords(left: ReconciliationStore, right: ReconciliationStore, id: string) {
  const ours = left.records(id)[Symbol.asyncIterator]();
  const theirs = right.records(id)[Symbol.asyncIterator]();
  for (;;) {
    const a = await ours.next();
    const b = await theirs.next();
    if (a.done || b.done) return Boolean(a.done && b.done);
    if (a.value.headword !== b.value.headword) return false;
    if (a.value.hash === b.value.hash) continue;
    const withoutAuthors = (row: typeof a.value) =>
      contentHash(
        JSON.parse(
          JSON.stringify({
            content: row.content,
            versions: row.versions,
            history: row.history.map((line) => ({ ...line, author: null })),
          }),
        ),
      );
    if (withoutAuthors(a.value) !== withoutAuthors(b.value)) return false;
    if (
      a.value.history.some(
        (line, index) =>
          line.author != null &&
          b.value.history[index].author != null &&
          line.author !== b.value.history[index].author,
      )
    )
      return false;
  }
}

/** Only snapshots of actual local content advance this head; previews never integrate incoming data. */
export async function captureCurrent(em: EntityManager, dataset: Dataset): Promise<ReconciliationRevision> {
  const lineage = await persistentLineage(em, dataset);
  const identity = await em.findOneByOrFail(ReconciliationIdentity, { key: 'self' });
  const revision = await new ReconciliationStore(em).capture(
    lineage,
    datasetSnapshotMetadata(dataset),
    true,
    dictionaryRecords(em, dataset),
    identity.heads,
  );
  await em.update(ReconciliationIdentity, { key: 'self' }, { heads: [revision.id] });
  return revision;
}

/** Import the immutable, reachable graph, verifying collisions instead of trusting matching IDs. */
export async function copyRevisionGraph(
  source: EntityManager,
  target: EntityManager,
  head: string,
): Promise<void> {
  const from = new ReconciliationStore(source);
  const to = new ReconciliationStore(target);
  const visited = new Set<string>();
  const pending = [head];
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const revision = await from.revision(id);
    const existing = await target.findOneBy(ReconciliationRevision, { id });
    if (existing) {
      if (
        contentHash(JSON.parse(JSON.stringify(existing))) !==
          contentHash(JSON.parse(JSON.stringify(revision))) ||
        !(await sameInheritedRecords(to, from, id))
      )
        throw new Error('reconciliation_revision_mismatch');
    } else {
      // Postgres RETURNING exposes simple-json defaults as text. Do not let the
      // insert replace this hydrated parents array before traversing it.
      await target
        .createQueryBuilder()
        .insert()
        .into(ReconciliationRevision)
        .values(revision)
        .updateEntity(false)
        .execute();
      for await (const record of from.records(id))
        await target.createQueryBuilder().insert().into('reconciliation_records').values(record).execute();
    }
    pending.push(...revision.parents);
  }
}

/** Unique maximal common ancestor in the causal graph. Criss-cross/legacy ambiguity requires review. */
export async function commonAncestor(
  store: ReconciliationStore,
  left: string,
  right: string,
): Promise<ReconciliationRevision | null> {
  const graph = new Map<string, ReconciliationRevision>();
  const reachable = async (head: string) => {
    const seen = new Set<string>();
    const pending = [head];
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const revision = graph.get(id) ?? (await store.revision(id));
      graph.set(id, revision);
      pending.push(...revision.parents);
    }
    return seen;
  };
  const ours = await reachable(left);
  const theirs = await reachable(right);
  const common = new Set([...ours].filter((id) => theirs.has(id)));
  const older = new Set<string>();
  const pending = [...common].flatMap((id) => graph.get(id)!.parents);
  while (pending.length) {
    const id = pending.pop()!;
    if (older.has(id)) continue;
    older.add(id);
    pending.push(...graph.get(id)!.parents);
  }
  const nearest = [...common].filter((id) => !older.has(id));
  return nearest.length === 1 ? graph.get(nearest[0])! : null;
}
