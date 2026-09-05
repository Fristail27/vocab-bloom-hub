import { Client } from 'pg';

// Companion of setup-e2e.ts for the Postgres mode (issue #400), registered in
// setupFilesAfterEnv so it can hook beforeAll. Before every spec file it
// creates this worker's database on first use and drops its schema, so each
// file starts empty and the app rebuilds the real production schema through
// the migrations (migrationsRun in typeorm-options). On sqlite there is
// nothing to do: every DataSource is a fresh :memory: database.
const adminUrl = process.env.E2E_DATABASE_URL;

if (adminUrl?.startsWith('postgres')) {
  // app.init() now runs the whole migration set per file — far past the 5s default
  jest.setTimeout(120_000);

  beforeAll(async () => {
    const workerDb = new URL(process.env.DATABASE_URL as string).pathname.replace(/^\//, '');

    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${workerDb}"`);
    } catch (error) {
      // 42P04: the database already exists (a previous file of this worker made it)
      if ((error as { code?: string }).code !== '42P04') throw error;
    } finally {
      await admin.end();
    }

    const worker = new Client({ connectionString: process.env.DATABASE_URL });
    await worker.connect();
    try {
      await worker.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    } finally {
      await worker.end();
    }
  });
}
