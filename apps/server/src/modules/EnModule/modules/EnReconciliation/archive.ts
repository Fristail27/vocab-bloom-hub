import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { contentHash, equalSides, resolve, validSide } from './compare';
import {
  ReconciliationIdentity,
  ReconciliationBaseline,
  ReconciliationItem,
  ReconciliationPlan,
  ReconciliationRecord,
  ReconciliationRevision,
} from './entities';

const TABLES = {
  identity: ReconciliationIdentity,
  revision: ReconciliationRevision,
  record: ReconciliationRecord,
  baseline: ReconciliationBaseline,
  operation: ReconciliationPlan,
  item: ReconciliationItem,
};

/** Immutable revisions and completed operations travel; pending review belongs to its instance. */
export async function exportSynchronization(em: EntityManager, path: string): Promise<number> {
  const output = await open(path, 'w');
  let count = 0;
  try {
    for (const [kind, entity] of Object.entries(TABLES)) {
      const metadata = em.connection.getMetadata(entity);
      const keys = metadata.primaryColumns.map((column) => column.propertyName);
      let last: ObjectLiteral | undefined;
      for (;;) {
        const qb = em.createQueryBuilder(entity, 'row');
        if (kind === 'operation') qb.andWhere('row.status = :status', { status: 'applied' });
        if (kind === 'item')
          qb.innerJoin(ReconciliationPlan, 'plan', 'plan.id = row.plan AND plan.status = :status', {
            status: 'applied',
          });
        if (last) {
          const clauses = keys.map((key, index) =>
            [
              ...keys.slice(0, index).map((previous) => `row.${previous} = :${previous}`),
              `row.${key} > :${key}`,
            ].join(' AND '),
          );
          qb.andWhere(`(${clauses.join(' OR ')})`, Object.fromEntries(keys.map((key) => [key, last![key]])));
        }
        keys.forEach((key) => qb.addOrderBy(`row.${key}`, 'ASC'));
        const rows = await qb.take(100).getMany();
        if (!rows.length) break;
        for (const row of rows) {
          await output.write(`${JSON.stringify({ format: 1, kind, data: row })}\n`);
          count++;
        }
        last = rows[rows.length - 1];
      }
    }
  } finally {
    await output.close();
  }
  return count;
}

/** Restore only into an empty synchronization store, in the importer's transaction. */
export async function importSynchronization(em: EntityManager, path: string): Promise<void> {
  for (const entity of Object.values(TABLES))
    if (await em.count(entity as EntityTarget<ObjectLiteral>))
      throw new Error('reconciliation_archive_requires_empty_target');
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const envelope = JSON.parse(line) as { format: unknown; kind: keyof typeof TABLES; data: ObjectLiteral };
      if (
        envelope.format !== 1 ||
        !Object.hasOwn(TABLES, envelope.kind) ||
        !envelope.data ||
        typeof envelope.data !== 'object' ||
        Array.isArray(envelope.data)
      )
        throw new Error('reconciliation_archive_invalid');
      const entity = TABLES[envelope.kind];
      const metadata = em.connection.getMetadata(entity);
      const columns = metadata.columns.map((column) => column.propertyName);
      const row = envelope.data;
      if (
        Object.keys(row).some((key) => !columns.includes(key)) ||
        metadata.primaryColumns.some((column) => typeof row[column.propertyName] !== 'string')
      )
        throw new Error('reconciliation_archive_invalid');
      if (
        envelope.kind === 'record' &&
        (!validSide({ present: true, value: row.content }) ||
          row.hash !==
            contentHash({ content: row.content, history: row.history ?? [], versions: row.versions ?? {} }))
      )
        throw new Error('reconciliation_archive_invalid');
      if (envelope.kind === 'revision' && row.sealed !== true)
        throw new Error('reconciliation_archive_invalid');
      if (envelope.kind === 'operation' && row.status !== 'applied')
        throw new Error('reconciliation_archive_invalid');
      if (envelope.kind === 'item') {
        const resolved = resolve(row.comparison, row.decisions);
        if (resolved.remaining || !equalSides(resolved.result, row.result))
          throw new Error('reconciliation_archive_invalid');
      }
      await em.createQueryBuilder().insert().into(entity).values(row).execute();
    }
  } finally {
    lines.close();
  }
  const invalid = async (query: ReturnType<EntityManager['createQueryBuilder']>) => {
    if (await query.getCount()) throw new Error('reconciliation_archive_invalid');
  };
  await invalid(
    em
      .createQueryBuilder(ReconciliationBaseline, 'baseline')
      .leftJoin(
        ReconciliationRevision,
        'revision',
        'revision.id = baseline.revision AND revision.lineage = baseline.lineage AND revision.sealed = true',
      )
      .where('revision.id IS NULL'),
  );
  await invalid(
    em
      .createQueryBuilder(ReconciliationRecord, 'record')
      .leftJoin(ReconciliationRevision, 'revision', 'revision.id = record.revision')
      .where('revision.id IS NULL'),
  );
  await invalid(
    em
      .createQueryBuilder(ReconciliationItem, 'item')
      .leftJoin(ReconciliationPlan, 'plan', 'plan.id = item.plan')
      .where('plan.id IS NULL'),
  );
  await invalid(
    em
      .createQueryBuilder(ReconciliationPlan, 'plan')
      .leftJoin(ReconciliationRevision, 'local', 'local.id = plan.local')
      .leftJoin(
        ReconciliationRevision,
        'incoming',
        'incoming.id = plan.incoming AND incoming.lineage = plan.lineage',
      )
      .leftJoin(ReconciliationRevision, 'baseline', 'baseline.id = plan.baseline')
      .where('local.id IS NULL OR incoming.id IS NULL OR (plan.baseline IS NOT NULL AND baseline.id IS NULL)'),
  );
}
