import { EnContentReview } from '../EnModule/entities/en_content_review.entity';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { datasetOrigin, defaultOrigins } from '../../../core/utils/provenance';
import { inheritOrigin } from '../../../core/utils/origin_acquisitions';
import { assertCompatibleOrigins, assertOrigins } from '../../core/utils/provenance';
import { selectDictionary } from '../../db/shared-dictionary/connection';
import { serialTables, sharedTable, type DictionaryTable } from '../../db/shared-dictionary/tables';
import { DICTIONARY_ENTITIES, EMBEDDING_ENTITIES } from '../EnModule/entities/dictionary-entities';
import { Dataset } from './entities/dataset.entity';
import type { ForkProgressT, OriginT, OriginAcquisitionT } from '../../../types';
import { ReconciliationStore } from '../EnModule/modules/EnReconciliation/store';
import { captureCurrent } from '../EnModule/modules/EnReconciliation/ancestry';
import { persistentLineage } from '../EnModule/modules/EnReconciliation/snapshot';
import { ReconciliationIdentity } from '../EnModule/modules/EnReconciliation/entities';
import { copyForkEmbeddings } from '../../core/embeddings/reuse';

/** The registry row, copied content and provenance become visible in one commit. */
export const forkDataset = async (
  connection: DataSource,
  source: Dataset,
  target: Dataset,
  progress: ForkProgressT,
): Promise<Dataset> => {
  const runner = connection.createQueryRunner();
  const quote = (name: string): string => connection.driver.escape(name);
  const tables = DICTIONARY_ENTITIES.filter(
    (entity) => entity !== EnContentReview && !EMBEDDING_ENTITIES.some((derived) => derived === entity),
  ).map((entity) => connection.getMetadata(entity));
  const junctions = tables.flatMap((meta) =>
    meta.ownRelations
      .filter((relation) => relation.isManyToManyOwner)
      .map((relation) => relation.junctionEntityMetadata!),
  );
  const copying = [...tables, ...junctions];
  const derived = EMBEDDING_ENTITIES.map((entity) => connection.getMetadata(entity));
  progress.total_tables = copying.length + derived.length;
  await runner.connect();
  await runner.startTransaction('REPEATABLE READ');
  try {
    const parent = await runner.manager.findOneOrFail(Dataset, {
      where: { id: source.id },
      lock: { mode: 'pessimistic_read' },
    });
    await selectDictionary(runner, parent.id);
    const ancestor = await captureCurrent(runner.manager, parent);
    const [{ revision }] = (await runner.query(`SELECT pg_current_snapshot()::text AS revision`)) as {
      revision: string;
    }[];
    const acquisition: OriginAcquisitionT = {
      id: randomUUID(),
      method: 'fork',
      recorded_at: new Date().toISOString(),
      revision,
    };
    const sourceOrigin = { ...datasetOrigin(parent), id: randomUUID() };
    const inherited = inheritOrigin(parent.origins ?? [], sourceOrigin, acquisition);
    target.origins = [...inherited.origins, ...(target.origins ?? [])];
    assertOrigins(target.origins);
    assertCompatibleOrigins(target.origins, target.license);
    const declared = (await runner.query(
      `SELECT DISTINCT "origins" FROM "en_words" WHERE "origins" IS NOT NULL`,
    )) as { origins: string }[];
    const wordOrigins = [null, ...declared.map((row) => row.origins)].map((original) => {
      const previous = original === null ? defaultOrigins(parent) : (JSON.parse(original) as OriginT[]);
      const { origins } = inheritOrigin(previous, sourceOrigin, acquisition, !parent.own);
      assertOrigins(origins);
      assertCompatibleOrigins(origins, target.license);
      return { original: original ?? '', origins: JSON.stringify(origins) };
    });
    const contributions = (await runner.query(`SELECT DISTINCT "contribution" FROM "en_changes"
      WHERE "superseded_at" IS NULL AND "contribution" IS NOT NULL`)) as { contribution: string }[];
    for (const row of contributions) {
      const origin = JSON.parse(row.contribution) as OriginT;
      assertOrigins([origin]);
      assertCompatibleOrigins([origin], target.license);
    }

    const saved = await runner.manager.save(Dataset, target);
    await selectDictionary(runner, saved.id);
    for (const meta of copying) {
      const columns = meta.columns.map((column) => quote(column.databaseName)).join(', ');
      const physical = sharedTable(meta.tableName as DictionaryTable);
      await runner.query(
        `INSERT INTO ${physical} (dataset_id, ${columns}) SELECT $1, ${columns} FROM ${physical} WHERE dataset_id=$2`,
        [saved.id, parent.id],
      );
      if (serialTables.has(meta.tableName as DictionaryTable)) {
        await runner.query(
          `INSERT INTO public.dataset_counters (dataset_id, table_name, last_id)
          SELECT $1, $2, COALESCE(max(id), 0) FROM ${physical} WHERE dataset_id=$1`,
          [saved.id, meta.tableName],
        );
      }
      progress.completed_tables++;
    }
    await copyForkEmbeddings(runner.manager, parent.id);
    progress.completed_tables += derived.length;
    // Retain immutable ancestors for later merges between siblings. Pending review plans
    // and operation state must never become operations of the new dataset.
    for (const [table, condition] of [
      ['reconciliation_revisions', 'sealed = true'],
      ['reconciliation_records', 'true'],
      ['reconciliation_plans', "status = 'applied'"],
      [
        'reconciliation_items',
        "plan IN (SELECT id FROM public.dictionary_reconciliation_plans WHERE dataset_id=$2 AND status='applied')",
      ],
    ] as const) {
      const physical = sharedTable(table);
      const columns = connection
        .getMetadata(table)
        .columns.map((column) => quote(column.databaseName))
        .join(', ');
      await runner.query(
        `INSERT INTO ${physical} (dataset_id, ${columns}) SELECT $1, ${columns} FROM ${physical} WHERE dataset_id=$2 AND ${condition}`,
        [saved.id, parent.id],
      );
    }
    await new ReconciliationStore(runner.manager).establish(ancestor.lineage, ancestor.id);
    // Only base words own their terms. Forms inherit through baseFormId.
    // Transform each distinct source snapshot once, then update the words in bulk.
    await runner.query(
      `CREATE TEMP TABLE "fork_origins" ("original" text NOT NULL, "origins" text NOT NULL) ON COMMIT DROP`,
    );
    for (let offset = 0; offset < wordOrigins.length; offset += 100) {
      await runner.query(
        `INSERT INTO "fork_origins" SELECT * FROM jsonb_to_recordset($1::jsonb) AS mapped("original" text, "origins" text)`,
        [JSON.stringify(wordOrigins.slice(offset, offset + 100))],
      );
    }
    await runner.query(`UPDATE "en_words" word SET "origins" = mapped."origins" FROM "fork_origins" mapped
      WHERE word."baseFormId" IS NULL AND COALESCE(word."origins", '') = mapped."original"`);
    await runner.query(`UPDATE "en_changes" SET "inherited_from" = $1 WHERE "inherited_from" IS NULL`, [
      JSON.stringify(inherited.origin),
    ]);
    await persistentLineage(runner.manager, saved);
    await runner.manager.update(ReconciliationIdentity, { key: 'self' }, { heads: [ancestor.id] });
    await runner.commitTransaction();
    return saved;
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
};
