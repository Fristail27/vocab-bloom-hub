import { DataSource, MigrationExecutor } from 'typeorm';
import { checkIsPostgres } from '../../configuration';
import { migrations } from './migrations';
import { preparePgvector } from './pgvector-bootstrap';

/** Migrate once, before accepting requests. Legacy namespaces are handled inside the upgrade migration. */
export async function prepareDatabase(): Promise<void> {
  if (!checkIsPostgres()) return;
  const db = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, migrations, extra: { max: 1 } });
  await db.initialize();
  try {
    await preparePgvector(db);
    await db.transaction(async (em) => {
      await em.query("SELECT pg_advisory_xact_lock(hashtext('vocab-bloom-hub:migrations'))");
      await new MigrationExecutor(db, em.queryRunner).executePendingMigrations();
    });
    const [{ registry }] = await db.query("SELECT to_regclass('public.datasets') AS registry");
    if (!registry)
      throw new Error('Missing datasets registry; inspect the migration journal (docs/migrations.md)');
  } finally {
    await db.destroy();
  }
}
