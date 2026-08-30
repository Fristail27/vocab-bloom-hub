import http from 'node:http';

// Must run before the entities are imported: checkIsPostgres() reads DATABASE_URL
// inside column decorators. An explicit in-memory sqlite keeps the e2e suite
// off both Postgres and the developer's dev.sqlite (issue #217).
process.env.DATABASE_URL = 'sqlite::memory:';

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
