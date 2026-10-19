// Start the site suite's API against a disposable database. The supplied URL
// is only an administrative connection; its database is never reset or seeded.
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';

const connectionString = process.env.SITE_E2E_POSTGRES_URL;
if (!connectionString) throw new Error('Set SITE_E2E_POSTGRES_URL to a PostgreSQL URL with CREATEDB rights');
const name = `vbh_site_e2e_${randomBytes(8).toString('hex')}`;
const admin = new pg.Client({ connectionString });
let created = false;
let child;
let stopping = false;
const stop = () => {
  stopping = true;
  child?.kill('SIGTERM');
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  if (!stopping) {
    const databaseUrl = new URL(connectionString);
    databaseUrl.pathname = `/${name}`;
    child = spawn('yarn', ['workspace', 'server', 'start'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
    });
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => {
        if (!stopping) process.exitCode = code ?? 1;
        resolve();
      });
    });
  }
} finally {
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
