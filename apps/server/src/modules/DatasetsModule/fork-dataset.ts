import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { datasetOrigin, defaultOrigins } from '../../../core/utils/provenance';
import { inheritOrigin } from '../../../core/utils/origin_acquisitions';
import { assertCompatibleOrigins, assertOrigins } from '../../core/utils/provenance';
import { assertSafeSchema, searchPathOf } from '../../db/datasets';
import { datasetMigrations, DATASET_MIGRATIONS_TABLE } from '../../db/dataset-migrations';
import { DICTIONARY_ENTITIES } from '../EnModule/entities/dictionary-entities';
import { Dataset } from './entities/dataset.entity';
import type { ForkProgressT, OriginT, OriginAcquisitionT } from '../../../types';

/** DDL and data commit together. A process crash cannot leave a staging schema. */
export const forkDataset = async (
  connection: DataSource,
  source: Dataset,
  target: Dataset,
  progress: ForkProgressT,
): Promise<Dataset> => {
  const runner = connection.createQueryRunner();
  const quote = (name: string): string => connection.driver.escape(name);
  const sourceSchema = quote(assertSafeSchema(source.schema));
  const targetSchema = quote(assertSafeSchema(target.schema));
  const tables = DICTIONARY_ENTITIES.map((entity) => connection.getMetadata(entity));
  const junctions = tables.flatMap((meta) =>
    meta.ownRelations
      .filter((relation) => relation.isManyToManyOwner)
      .map((relation) => relation.junctionEntityMetadata!),
  );
  const copying = [...tables, ...junctions];
  progress.total_tables = copying.length;
  await runner.connect();
  await runner.startTransaction('REPEATABLE READ');
  try {
    // Keep a deletion or import from dropping/truncating source tables while
    // the transaction is reading the snapshot; ordinary row edits can proceed.
    await runner.query(
      `LOCK TABLE ${copying.map((meta) => `${sourceSchema}.${quote(meta.tableName)}`).join(', ')} IN ACCESS SHARE MODE`,
    );
    const parent = await runner.manager.findOneOrFail(Dataset, { where: { id: source.id } });
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
      `SELECT DISTINCT "origins" FROM ${sourceSchema}."en_words" WHERE "origins" IS NOT NULL`,
    )) as { origins: string }[];
    const wordOrigins = [null, ...declared.map((row) => row.origins)].map((original) => {
      const previous = original === null ? defaultOrigins(parent) : (JSON.parse(original) as OriginT[]);
      const { origins } = inheritOrigin(previous, sourceOrigin, acquisition, !parent.own);
      assertOrigins(origins);
      assertCompatibleOrigins(origins, target.license);
      return { original: original ?? '', origins: JSON.stringify(origins) };
    });
    const contributions = (await runner.query(`SELECT DISTINCT "contribution" FROM ${sourceSchema}."en_changes"
      WHERE "superseded_at" IS NULL AND "contribution" IS NOT NULL`)) as { contribution: string }[];
    for (const row of contributions) {
      const origin = JSON.parse(row.contribution) as OriginT;
      assertOrigins([origin]);
      assertCompatibleOrigins([origin], target.license);
    }

    await runner.query(`CREATE SCHEMA ${targetSchema}`);
    await runner.query(`SET LOCAL search_path TO ${searchPathOf(target.schema)}`);
    await runner.query(
      `CREATE TABLE "${DATASET_MIGRATIONS_TABLE}" ("id" SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, "name" varchar NOT NULL)`,
    );
    for (const Migration of datasetMigrations) {
      const migration = new Migration();
      await migration.up(runner);
      await runner.query(`INSERT INTO "${DATASET_MIGRATIONS_TABLE}" ("timestamp", "name") VALUES ($1, $2)`, [
        Number(migration.name.slice(-13)),
        migration.name,
      ]);
    }
    for (const meta of copying) {
      const columns = meta.columns.map((column) => quote(column.databaseName)).join(', ');
      await runner.query(
        `INSERT INTO ${targetSchema}.${quote(meta.tableName)} (${columns}) SELECT ${columns} FROM ${sourceSchema}.${quote(meta.tableName)}`,
      );
      for (const column of meta.generatedColumns) {
        if (column.generationStrategy !== 'increment') continue;
        await runner.query(
          `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE(MAX(${quote(column.databaseName)}), 1), MAX(${quote(column.databaseName)}) IS NOT NULL) FROM ${targetSchema}.${quote(meta.tableName)}`,
          [`${targetSchema}.${quote(meta.tableName)}`, column.databaseName],
        );
      }
      progress.completed_tables++;
    }
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
    const saved = await runner.manager.save(Dataset, target);
    await runner.commitTransaction();
    return saved;
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
};
