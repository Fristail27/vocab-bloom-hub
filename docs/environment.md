# Environment variables

A single `.env` file at the **repository root** is used by both apps:

- the server loads it at the very top of `apps/server/src/main.ts` (before any entity import — see
  [Driver locking](#database-driver-locking));
- the frontend scripts wrap Next.js with `dotenv -e ../../.env`.

In deployments without an `.env` file the variables can come from the process environment; the
server logs a warning when the root `.env` could not be loaded.

## Variables

| Variable                   | Required          | Default                            | Used by  | Description                                                                                                                                                                                                                                                         |
| -------------------------- | ----------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USERNAME`                 | **yes**           | —                                  | server   | Admin login. Together with `PASSWORD` it derives the login-proof key and the JWT signing secret (see [authentication.md](./authentication.md)).                                                                                                                     |
| `PASSWORD`                 | **yes**           | —                                  | server   | Admin password. The server refuses to start when it is missing or blank.                                                                                                                                                                                            |
| `DATABASE_URL`             | **in production** | SQLite fallback (dev only)         | server   | Postgres connection string (`postgres://user:pass@host:5432/db`). When absent in development, TypeORM falls back to `dev.sqlite` at the repo root. With Postgres the schema is managed by migrations (see [migrations.md](./migrations.md)).                        |
| `SERVER_PORT`              | no                | `3010`                             | server   | Port the NestJS API listens on.                                                                                                                                                                                                                                     |
| `FRONT_PORT`               | no                | `3000`                             | frontend | Port the Next.js dev server listens on (wired through `next.config.ts`).                                                                                                                                                                                            |
| `NEXT_PUBLIC_BASE_API_URL` | no                | `/api`                             | frontend | Base URL the browser uses for API requests. Inlined at build time (`NEXT_PUBLIC_` prefix), so a change requires a rebuild.                                                                                                                                          |
| `CORS_ORIGINS`             | no                | `http://localhost:<FRONT_PORT>`    | server   | Comma-separated list of allowed CORS origins, e.g. `https://admin.example.com,https://staging.example.com`.                                                                                                                                                         |
| `LOG_LEVEL`                | no                | `debug` in development, else `log` | server   | Minimum server log level: `verbose` / `debug` / `log` / `warn` / `error` / `fatal`. Unknown values fall back to the default.                                                                                                                                        |
| `NODE_ENV`                 | no                | —                                  | both     | `development` enables debug logging; `production` makes the auth cookie `secure`, requires `DATABASE_URL` and disables the Swagger UI at `/api`. Schema management does not depend on it: the SQLite fallback always synchronizes, Postgres always uses migrations. |

## Startup validation

The server validates its configuration before Nest is created (`assertRequiredConfig` in
`apps/server/configuration.ts`) and exits with code 1 and a clear error message when:

- `USERNAME` or `PASSWORD` is missing or blank — this also protects against the silent fail-open
  where an unloaded `.env` leaves `USERNAME` set by the OS and the password hashes as the literal
  string `"undefined"`;
- `NODE_ENV=production` and `DATABASE_URL` is not set — production never falls back to SQLite
  silently.

The resolved database driver is logged at startup:
`Database: Postgres (DATABASE_URL)` or `better-sqlite3 fallback (dev.sqlite)`.

## Database driver locking

Entity column types are resolved **at import time** inside TypeORM decorators
(`checkIsPostgres()`), so the driver choice is locked at the first call and stays consistent for
the lifetime of the process. `assertDatabaseDriverConsistent()` fails the startup when entities
were imported before the environment was loaded (e.g. a custom entry point that forgets to load
`.env` first). Tests that need the SQLite types import
`__tests__/helpers/clearDatabaseUrl.ts` before any entity for the same reason.

## Example `.env`

```dotenv
SERVER_PORT=3010
FRONT_PORT=3000
NODE_ENV=development
USERNAME=admin
PASSWORD=change-me
# Optional in development (falls back to dev.sqlite), required in production:
DATABASE_URL=postgres://user:password@localhost:5432/vocab_bloom
NEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api
# Optional, defaults to http://localhost:<FRONT_PORT>:
CORS_ORIGINS=http://localhost:3000
```
