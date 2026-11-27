import { createDictionaryIndexes } from './indexes';
import type { QueryRunner } from 'typeorm';
import {
  dictionaryKeys,
  dictionaryRelations,
  dictionaryTables,
  type DictionaryTable,
  serialTables,
  sharedTable,
} from './tables';

const quote = (identifier: string) => '"' + identifier.replaceAll('"', '""') + '"';

type DatasetLocation = { id: number; schema: string };

async function columns(runner: QueryRunner, relation: string): Promise<string[]> {
  const rows: { name: string }[] = await runner.query(
    'SELECT attname AS name FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attname',
    [relation],
  );
  return rows.map(({ name }) => name);
}

/** Run while the old server is stopped. The caller owns commit/rollback, including cutover. */
export async function copyLegacyDictionary(runner: QueryRunner): Promise<void> {
  if (!runner.isTransactionActive) throw new Error('Dictionary migration requires a transaction');
  await runner.query('LOCK TABLE public.datasets IN SHARE ROW EXCLUSIVE MODE');
  const datasets: DatasetLocation[] = await runner.query('SELECT id, schema FROM public.datasets ORDER BY id');
  if (!datasets.some((dataset) => dataset.schema === 'public')) throw new Error('Missing default dictionary');
  for (const { schema } of datasets) {
    const sources = dictionaryTables.map((table) => `${quote(schema)}.${quote(table)}`);
    await runner.query(`LOCK TABLE ${sources.join(', ')} IN SHARE MODE`);
  }
  await runner.query(`CREATE TABLE public.dataset_counters (
    dataset_id integer NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    table_name text NOT NULL, last_id integer NOT NULL, PRIMARY KEY (dataset_id, table_name))`);
  const [{ sharedReviews }] = await runner.query(
    `SELECT EXISTS (SELECT 1 FROM public.migrations WHERE name='ShareContentReviews1795600000000') AS "sharedReviews"`,
  );
  for (const table of dictionaryTables) {
    await copyTable(runner, datasets, table, table === 'en_content_reviews' && sharedReviews);
  }

  await createDictionaryIndexes(runner);
  for (const table of dictionaryTables) await runner.query(`ANALYZE ${sharedTable(table)}`);
  await runner.query(
    `ALTER TABLE ${sharedTable('en_embedding_profiles')} ADD UNIQUE (dataset_id, id, dimensions)`,
  );
  for (const [from, fk, to, key, action] of dictionaryRelations) {
    // PostgreSQL 14 can SET NULL only on the whole composite key. Keep the
    // owner and clear only the optional link when its referenced row goes.
    const nullable = action === 'ON DELETE SET NULL';
    if (nullable) {
      const fn = 'public.' + quote('detach_' + from + '_' + fk.replaceAll('"', ''));
      await runner.query(`CREATE OR REPLACE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          UPDATE ${sharedTable(from)} SET ${fk} = NULL WHERE dataset_id = OLD.dataset_id AND ${fk} = OLD.${key};
          RETURN OLD;
        END $$`);
      await runner.query(`CREATE TRIGGER ${quote('detach_' + from + '_' + fk.replaceAll('"', ''))}
        AFTER DELETE ON ${sharedTable(to)} FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
    }
    await runner.query(`ALTER TABLE ${sharedTable(from)} ADD FOREIGN KEY (dataset_id, ${fk})
      REFERENCES ${sharedTable(to)} (dataset_id, ${key}) ${nullable ? 'DEFERRABLE INITIALLY DEFERRED' : action}`);
  }
}

async function copyTable(
  runner: QueryRunner,
  datasets: DatasetLocation[],
  table: DictionaryTable,
  reuseSharedReviews: boolean,
): Promise<void> {
  const target = sharedTable(table);
  const template = `public.${quote(table)}`;
  const names = await columns(runner, template);
  const fields = names.map(quote).join(', ');
  if (reuseSharedReviews) {
    // The earlier reviews migration kept the per-dataset tables alongside this one.
    await runner.query(`LOCK TABLE ${target} IN ACCESS EXCLUSIVE MODE`);
  } else {
    await runner.query(`CREATE TABLE ${target} (
      dataset_id integer NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
      LIKE ${template} INCLUDING DEFAULTS INCLUDING CONSTRAINTS,
      PRIMARY KEY (dataset_id, ${dictionaryKeys[table]})
    )`);
  }
  const serial = serialTables.has(table);
  for (const { id, schema } of datasets) {
    const source = `${quote(schema)}.${quote(table)}`;
    if ((await columns(runner, source)).join(',') !== names.join(',')) {
      throw new Error(`Columns differ in ${source}; apply legacy migrations before upgrading`);
    }
    const onConflict = reuseSharedReviews ? 'ON CONFLICT (dataset_id, scope, identity) DO NOTHING' : '';
    await runner.query(
      `INSERT INTO ${target} (dataset_id, ${fields}) SELECT $1, ${fields} FROM ${source} ${onConflict}`,
      [id],
    );
    // Every source row must match in full, including reviews already present.
    // Only the pre-existing reviews table may also contain shared-only rows.
    const [{ equalCount, missingRows }] = await runner.query(
      `SELECT
      (SELECT count(*) FROM ${source}) = (SELECT count(*) FROM ${target} WHERE dataset_id = $1) AS "equalCount",
      EXISTS (SELECT ${fields} FROM ${source} EXCEPT SELECT ${fields} FROM ${target} WHERE dataset_id = $1) AS "missingRows"`,
      [id],
    );
    if (missingRows || (!reuseSharedReviews && !equalCount)) {
      throw new Error(`Dictionary copy differs for ${source}`);
    }
    if (serial) {
      const [{ value }] = await runner.query(
        `SELECT GREATEST(
        (SELECT max(id) FROM ${source}),
        pg_sequence_last_value(pg_get_serial_sequence($1, 'id')::regclass)
      ) AS value`,
        [source],
      );
      await runner.query(
        'INSERT INTO public.dataset_counters (dataset_id, table_name, last_id) VALUES ($1,$2,$3)',
        [id, table, value ?? 0],
      );
    }
  }
  if (serial) await runner.query(`ALTER TABLE ${target} ALTER COLUMN id DROP DEFAULT`);
}
