// The query-plan guard (issue #279) runs against Postgres only: it reads
// DATABASE_URL from the process environment or the root .env, and refuses
// anything else before the entities lock their column types on the driver.
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? '')) {
  throw new Error(
    'test:plans needs a postgres:// DATABASE_URL (the migrations must be applied). ' +
      'Run it against a loaded dictionary for meaningful plans, or against an empty database in CI.',
  );
}
process.env.ADMIN_USERNAME ??= 'plans-admin';
process.env.ADMIN_PASSWORD ??= 'plans-password';
process.env.LOG_LEVEL ??= 'warn';
