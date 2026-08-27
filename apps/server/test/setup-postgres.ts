// The Postgres-only suites (`*.pg-spec.ts`: the query-plan guard of #279,
// the trigram search of #278) read DATABASE_URL from the process environment
// or the root .env, and refuse anything else before the entities lock their
// column types on the driver.
import http from 'node:http';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? '')) {
  throw new Error(
    'test:postgres needs a postgres:// DATABASE_URL (the migrations must be applied). ' +
      'Run it against a loaded dictionary for meaningful plans, or against an empty database in CI.',
  );
}
process.env.ADMIN_USERNAME ??= 'plans-admin';
process.env.ADMIN_PASSWORD ??= 'plans-password';
process.env.LOG_LEVEL ??= 'warn';

// supertest starts a fresh ephemeral server for every request and closes it
// afterwards, while Node 19+ keeps client sockets alive in http.globalAgent:
// a pooled socket to a port the OS just handed to the next server races its
// close and surfaces as "Parse Error: Expected HTTP/" or ECONNRESET, about
// once in ten full runs. One connection per request removes the race.
http.globalAgent = new http.Agent({ keepAlive: false });
