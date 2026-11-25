import type { MigrationInterface, QueryRunner } from 'typeorm';
import { datasetMigrations } from '../dataset-migrations';
import { copyLegacyDictionary } from '../shared-dictionary/copy';
import { dictionaryTables, serialTables, sharedTable } from '../shared-dictionary/tables';

const quote = (identifier: string) => '"' + identifier.replaceAll('"', '""') + '"';

/** The legacy journal and search path are used once, while upgrading an offline database. */
export class ShareDictionaryTables1795600000000 implements MigrationInterface {
  name = 'ShareDictionaryTables1795600000000';

  async up(runner: QueryRunner): Promise<void> {
    if (!runner.isTransactionActive) throw new Error('Dictionary upgrade requires a transaction');
    await runner.query('LOCK TABLE public.datasets IN ACCESS EXCLUSIVE MODE');
    const datasets: { name: string; schema: string }[] = await runner.query(
      'SELECT name, schema FROM public.datasets ORDER BY id',
    );
    for (const { schema } of datasets) {
      await runner.query(`SET LOCAL search_path TO ${quote(schema)}, public`);
      // Older releases can be behind on dataset migrations. On fresh installs the
      // shared baseline created the default tables and recorded the first migration.
      const journal = quote(schema) + '.dataset_migrations';
      const done: { name: string }[] = await runner.query(`SELECT name FROM ${journal}`);
      for (const Migration of datasetMigrations) {
        const legacy = new Migration();
        if (!done.some(({ name }) => legacy.name === name)) {
          await legacy.up(runner);
          await runner.query(`INSERT INTO ${journal} (timestamp,name) VALUES ($1,$2)`, [
            legacy.name.slice(-13),
            legacy.name,
          ]);
        }
      }
    }
    await runner.query('SET LOCAL search_path TO public');
    await copyLegacyDictionary(runner);
    // Drop only the objects this application owns, without CASCADE. An external
    // dependent object stops the upgrade and rolls the copy back for inspection.
    for (const { schema } of datasets) {
      const tables = [...dictionaryTables, 'dataset_migrations'].map(
        (table) => quote(schema) + '.' + quote(table),
      );
      await runner.query(`DROP TABLE ${tables.join(', ')}`);
      if (schema !== 'public') await runner.query(`DROP SCHEMA ${quote(schema)}`);
    }
    await runner.query('ALTER TABLE public.datasets DROP COLUMN schema');
    await runner.query(`CREATE OR REPLACE FUNCTION public.dictionary_dataset_id() RETURNS integer
      LANGUAGE sql STABLE PARALLEL SAFE AS $$ SELECT NULLIF(current_setting('vbh.dataset_id', true), '')::integer $$`);
    await runner.query(`CREATE OR REPLACE FUNCTION public.dictionary_next_id(counter text) RETURNS integer
      LANGUAGE sql VOLATILE AS $$
        INSERT INTO public.dataset_counters (dataset_id, table_name, last_id)
        VALUES (public.dictionary_dataset_id(), counter, 1)
        ON CONFLICT (dataset_id, table_name) DO UPDATE SET last_id = dataset_counters.last_id + 1
        RETURNING last_id $$`);
    // A source copy, vector import or reconciliation can freeze this dataset's
    // content. Other datasets keep writing on the same physical tables.
    await runner.query(`CREATE OR REPLACE FUNCTION public.dictionary_write_lock() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock_shared(691, public.dictionary_dataset_id()); RETURN NULL; END $$`);
    for (const table of dictionaryTables) {
      const owner = 'public.dictionary_dataset_id()';
      await runner.query(`ALTER TABLE ${sharedTable(table)} ALTER COLUMN dataset_id SET DEFAULT ${owner}`);
      if (serialTables.has(table))
        await runner.query(
          `ALTER TABLE ${sharedTable(table)} ALTER COLUMN id SET DEFAULT public.dictionary_next_id('${table}')`,
        );
      await runner.query(`CREATE TRIGGER dictionary_write_lock BEFORE INSERT OR UPDATE OR DELETE ON ${sharedTable(table)}
        FOR EACH STATEMENT EXECUTE FUNCTION public.dictionary_write_lock()`);
      const columns: { name: string }[] = await runner.query(
        "SELECT attname AS name FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped AND attname<>'dataset_id' ORDER BY attnum",
        [sharedTable(table)],
      );
      const projection = columns.map(({ name }) => quote(name)).join(', ');
      await runner.query(`CREATE VIEW public."${table}" AS SELECT ${projection}, dataset_id FROM ${sharedTable(table)}
        WHERE dataset_id = ${owner} WITH CASCADED CHECK OPTION`);
    }
  }

  async down(): Promise<void> {
    throw new Error('Restore the backup taken before the shared dictionary upgrade (docs/migrations.md).');
  }
}
