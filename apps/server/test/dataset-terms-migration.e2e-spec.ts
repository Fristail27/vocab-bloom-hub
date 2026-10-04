import { DataSource } from 'typeorm';
import { checkIsPostgres } from '../configuration';
import { defaultOrigins } from '../core/utils/provenance';
import { prepareDatabase } from '../src/db/datasets';
import { migrations } from '../src/db/migrations';
import { AddDatasetTermsUpdatedAt1790200002000 } from '../src/db/migrations/1790200002000-AddDatasetTermsUpdatedAt';
import { Dataset } from '../src/modules/DatasetsModule/entities/dataset.entity';

const pg = checkIsPostgres() ? it : it.skip;

// setup-e2e-db creates a separate database for this worker and resets its
// schema before this file. Simulate upgrades there, never on an instance's DB.
pg('upgrades dataset terms from both earlier provenance schemas without losing stored data', async () => {
  const repair = new AddDatasetTermsUpdatedAt1790200002000();
  const legacy = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [],
    migrations: migrations.filter((migration) => migration !== AddDatasetTermsUpdatedAt1790200002000),
  });
  // Read through the entity after the real startup migrations, just as
  // DatasetsService.onModuleInit does. No migrations on this read connection.
  const reader = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, entities: [Dataset] });
  await legacy.initialize();
  try {
    await legacy.runMigrations();
    const [dataset] = (await legacy.query(
      `SELECT * FROM "public"."datasets" WHERE "name" = 'default'`,
    )) as Dataset[];
    const description = 'An existing dataset';
    const origins = defaultOrigins(dataset);
    await legacy.query(`UPDATE "public"."datasets" SET "description" = $1, "origins" = $2`, [
      description,
      JSON.stringify(origins),
    ]);
    await legacy.query(`INSERT INTO "public"."en_entries" ("word") VALUES ('legacy-word')`);
    const columns = await legacy.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'datasets' AND column_name = 'terms_updated_at'`,
    );
    expect(columns).toEqual([]);

    await expect(prepareDatabase()).resolves.toBe('public');
    await reader.initialize();
    const read = () => reader.getRepository(Dataset).findOneByOrFail({ name: 'default' });
    expect(await read()).toMatchObject({ description, origins, terms_updated_at: null });
    expect(await legacy.query(`SELECT "word" FROM "public"."en_entries"`)).toEqual([{ word: 'legacy-word' }]);

    // An intermediate build created the column inside AddDatasetOrigins.
    // Only the new migration is pending; its existing timestamp must survive.
    const updatedAt = new Date('2026-10-02T12:00:00.000Z');
    await legacy.query(`UPDATE "public"."datasets" SET "terms_updated_at" = $1`, [updatedAt]);
    await legacy.query(`DELETE FROM "public"."migrations" WHERE "name" = $1`, [repair.name]);
    await expect(prepareDatabase()).resolves.toBe('public');
    expect(await read()).toMatchObject({ description, origins, terms_updated_at: updatedAt });
    expect(
      await legacy.query(`SELECT "name" FROM "public"."migrations" WHERE "name" = $1`, [repair.name]),
    ).toEqual([{ name: repair.name }]);
  } finally {
    if (reader.isInitialized) await reader.destroy();
    await legacy.destroy();
  }
});
