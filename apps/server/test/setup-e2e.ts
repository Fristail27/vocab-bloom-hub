import http from 'node:http';

// Must run before the entities are imported: checkIsPostgres() reads DATABASE_URL
// inside column decorators, so the driver is locked per jest worker process.
//
// By default the suite runs on an explicit in-memory sqlite, keeping it off both
// Postgres and the developer's dev.sqlite (issue #217). Set E2E_DATABASE_URL to
// a postgres:// URL to run the same specs against Postgres — the database every
// operator actually runs (issue #400; CI does this in the postgres job). Each
// jest worker then gets its own database, derived from the URL's database name,
// so parallel workers never share tables; setup-e2e-db.ts creates it and resets
// its schema before every spec file.
const postgresUrl = process.env.E2E_DATABASE_URL;
if (postgresUrl?.startsWith('postgres')) {
  const url = new URL(postgresUrl);
  const baseName = url.pathname.replace(/^\//, '') || 'vocab_bloom';
  url.pathname = `/${baseName}_e2e_w${process.env.JEST_WORKER_ID ?? '1'}`;
  process.env.DATABASE_URL = url.toString();
} else {
  process.env.DATABASE_URL = 'sqlite::memory:';
}

// supertest starts a fresh ephemeral server for every request and closes it
// afterwards, while Node 19+ keeps client sockets alive in http.globalAgent:
// a pooled socket to a port the OS just handed to the next server races its
// close and surfaces as "Parse Error: Expected HTTP/" or ECONNRESET, about
// once in ten full runs. One connection per request removes the race.
http.globalAgent = new http.Agent({ keepAlive: false });

// Every request writes one log line since issue #280; the suites make
// thousands, so the shared default is the warnings only — a suite that
// asserts on the log passes its own level (logging.e2e-spec.ts)
process.env.LOG_LEVEL ??= 'warn';
