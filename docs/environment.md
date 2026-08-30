# Environment variables

A single `.env` file at the **repository root** is used by both apps:

- the server loads it at the very top of `apps/server/src/main.ts` (before any entity import — see
  [Driver locking](#database-driver-locking));
- the frontend scripts wrap Next.js with `dotenv -e "${ENV_FILE:-../../.env}"`.

**`ENV_FILE`** names another file, for a build that runs outside the repository tree or keeps its
secrets under `/etc`: `ENV_FILE=/etc/vocab-bloom-hub/.env yarn start`. The server logs which file
it loaded and exits with code 1 when an explicitly named file cannot be read (a missing default
is only a warning: the variables may come from the process environment). Use an absolute path —
the server resolves a relative one from its working directory, the frontend scripts from
`apps/frontend`. Variables already present in the process environment always win over the file
(dotenv never overrides them).

In deployments without an `.env` file the variables can come from the process environment; the
server logs a warning when the root `.env` could not be loaded.

## Variables

> **Renamed in #261:** the admin credentials used to be `USERNAME` / `PASSWORD`. They are now
> `ADMIN_USERNAME` / `ADMIN_PASSWORD`; the old names are not read anymore, so update existing
> `.env` files and deployment configs. The rename avoids the collision with the `USERNAME`
> variable that most operating systems set to the current system user.

| Variable                   | Required          | Default                                  | Used by  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------- | ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_USERNAME`           | **yes**           | —                                        | server   | Admin login. Together with `ADMIN_PASSWORD` it derives the login-proof key and the JWT signing secret (see [authentication.md](./authentication.md)).                                                                                                                                                                                                                                                                                                                                                                                 |
| `ADMIN_PASSWORD`           | **yes**           | —                                        | server   | Admin password. The server refuses to start when it is missing or blank.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DATABASE_URL`             | **in production** | SQLite fallback (dev only)               | server   | Database URL; the scheme selects the driver. `postgres://user:pass@host:5432/db` (or `postgresql://`) runs Postgres with the schema managed by migrations (see [migrations.md](./migrations.md)). `sqlite:<path>` (e.g. `sqlite:./my.sqlite`, `sqlite::memory:`) runs better-sqlite3 with `synchronize` — used by the browser e2e tests for an isolated database. Any other scheme fails startup. When absent in development, TypeORM falls back to `dev.sqlite` at the repo root.                                                    |
| `SERVER_PORT`              | no                | `3010`                                   | server   | Port the NestJS API listens on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `FRONT_PORT`               | no                | `3000`                                   | frontend | Port the Next.js dev server listens on (wired through `next.config.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `NEXT_PUBLIC_BASE_API_URL` | no                | `/api`                                   | frontend | Base URL the browser uses for API requests. Inlined at build time (`NEXT_PUBLIC_` prefix), so a change requires a rebuild. A relative value (the default) is resolved against the page origin — "the API is under this origin", which the reverse proxy provides. Server-side rendering uses it too unless `API_INTERNAL_URL` is set, and then it must be absolute.                                                                                                                                                                   |
| `API_INTERNAL_URL`         | no                | — (`NEXT_PUBLIC_BASE_API_URL`)           | frontend | Runtime address the frontend process itself uses for the API, without the proxy: `http://server:3010/api` in `docker-compose.yml`. Used for server-side rendering and for forwarding `/api/*` requests that reach the frontend origin (no reverse proxy in front); for the forwarding it falls back to `http://127.0.0.1:<SERVER_PORT>/api`. Never sent to the browser.                                                                                                                                                               |
| `CORS_ORIGINS`             | no                | `http://localhost:<FRONT_PORT>`          | server   | Comma-separated list of allowed CORS origins, e.g. `https://admin.example.com,https://staging.example.com`.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `TRUST_PROXY`              | no                | — (headers ignored)                      | server   | Express `trust proxy` setting: a hop count (`1` for one reverse proxy), `loopback`, an IP / CIDR list, or `true`. Makes rate limits and logs use the client address from `X-Forwarded-For`. Set it only behind a proxy; see [deployment/reverse-proxy.md](./deployment/reverse-proxy.md).                                                                                                                                                                                                                                             |
| `METRICS_ENABLED`          | no                | `false`                                  | server   | Serves Prometheus metrics at `METRICS_PATH` (process, HTTP by route template, search tiers, dictionary size, transfers, Postgres pool). Keep the endpoint off the public internet; see [observability.md](./observability.md).                                                                                                                                                                                                                                                                                                        |
| `METRICS_PATH`             | no                | `/metrics`                               | server   | Path of the metrics endpoint, outside both API surfaces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `PUBLIC_API_ENABLED`       | no                | `true`                                   | server   | Serves the public read-only prefix `/api/v1`. `false` makes those routes answer `404` (admin-only instance). See [api.md](./api.md).                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ADMIN_API_ENABLED`        | no                | `true`                                   | server   | Serves the admin surface (`/api/en`, `/api/settings`, `/api/auth`). `false` makes those routes answer `404` (public-only instance); disabling both surfaces fails startup.                                                                                                                                                                                                                                                                                                                                                            |
| `PUBLIC_API_RATE_LIMIT`    | no                | `100/60`                                 | server   | Requests per client IP allowed on the whole `/api/v1` prefix, as `<requests>/<seconds>`. Anything else fails startup.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `PUBLIC_API_CACHE_MAX_AGE` | no                | `3600`                                   | server   | Seconds a shared cache (browser, CDN, reverse proxy) may keep a public GET answer: `Cache-Control: public, max-age=<value>` on every successful `/api/v1` GET. `0` sends `public, no-cache` (revalidate on each use; the `ETag` makes that a bodiless `304`). Anything but a non-negative integer fails startup. See [api.md](./api.md#caching).                                                                                                                                                                                      |
| `DICTIONARY_IMPORT_DIR`    | no                | — (server-side datasets disabled)        | server   | Folder the dictionary import may read datasets from (zip archives or dataset folders in the export format, one level deep), e.g. a mounted volume. Paths in import requests are resolved inside it only. Unset, the _From file_ tab of the import page offers uploads only. See [offline-import.md](./offline-import.md).                                                                                                                                                                                                             |
| `DICTIONARY_AUTO_IMPORT`   | no                | `false` (`true` in `docker-compose.yml`) | server   | Load the dictionary by itself on first start: when no dataset version is recorded in the settings, the server imports the newest dataset in `DICTIONARY_IMPORT_DIR` or, without one, the published dataset from HuggingFace — in the background, with progress in the log; `GET /api/ready` answers `503 importing` meanwhile and `503 import_failed` after a failure (the next start retries). A recorded version means nothing happens. See [deployment/docker.md](./deployment/docker.md#first-start-the-dictionary-loads-itself). |
| `LOG_LEVEL`                | no                | `debug` in development, else `log`       | server   | Minimum server log level: `verbose` / `debug` / `log` / `warn` / `error` / `fatal` (pino's `trace` / `info` accepted too). Unknown values fall back to the default. See [observability.md](./observability.md#logs).                                                                                                                                                                                                                                                                                                                  |
| `LOG_FORMAT`               | no                | `json` in production, else `pretty`      | server   | Shape of the log lines on stdout: `json` — one JSON object per line for a log collector (request id, method, path, status, duration; errors with their stack) — or `pretty` for a terminal. Anything else fails startup. See [observability.md](./observability.md#logs).                                                                                                                                                                                                                                                             |
| `ENV_FILE`                 | no                | the root `.env`                          | both     | Path of the environment file to load instead of the repository root `.env` (absolute path). The server exits when the named file cannot be read; see above.                                                                                                                                                                                                                                                                                                                                                                           |
| `SHUTDOWN_TIMEOUT`         | no                | `30`                                     | server   | Seconds a graceful stop may take after SIGTERM / SIGINT: the listener closes, requests in flight finish, the database pool closes. Past the budget the server logs `forcing exit` and exits with code 1 instead of waiting for the process manager's SIGKILL. Whole seconds, at least 1; anything else fails startup. See [deployment/README.md](./deployment/README.md#stopping-and-restarting).                                                                                                                                     |
| `NODE_ENV`                 | no                | —                                        | both     | `development` enables debug logging; `production` makes the auth cookie `secure`, requires a `postgres://` `DATABASE_URL` and disables the Swagger UI at `/api`. Schema management does not depend on it: SQLite always synchronizes, Postgres always uses migrations.                                                                                                                                                                                                                                                                |

## Startup validation

The server validates its configuration before Nest is created (`assertRequiredConfig` in
`apps/server/configuration.ts`) and exits with code 1 and a clear error message when:

- `ADMIN_USERNAME` or `ADMIN_PASSWORD` is missing or blank — this protects against the silent
  fail-open where an unloaded `.env` leaves the credentials undefined and the password hashes as
  the literal string `"undefined"`. The `ADMIN_` prefix is deliberate: a bare `USERNAME` is
  commonly set by the OS to the current system user and would silently satisfy the check;
- `NODE_ENV=production` and `DATABASE_URL` is not a `postgres://` connection string — production
  never runs on SQLite silently;
- `DATABASE_URL` is set but its scheme is not recognized (`postgres://`, `postgresql://` or
  `sqlite:<path>`) — guessing the driver would silently switch how the schema is managed
  (auto-DDL vs migrations);
- `ENV_FILE` names a file that cannot be read, or `SHUTDOWN_TIMEOUT`, `LOG_FORMAT`,
  `PUBLIC_API_RATE_LIMIT`, `PUBLIC_API_CACHE_MAX_AGE` hold values that do not parse.

The resolved database driver is logged at startup:
`Database: Postgres (DATABASE_URL)` or `better-sqlite3 (<path>)`.

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
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
# Optional in development (falls back to dev.sqlite), required in production.
# The scheme picks the driver: postgres://... or an explicit sqlite:<path>
DATABASE_URL=postgres://user:password@localhost:5432/vocab_bloom
NEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api
# Optional, defaults to http://localhost:<FRONT_PORT>:
CORS_ORIGINS=http://localhost:3000
# Behind a reverse proxy only: how many proxy hops set X-Forwarded-For (docs/deployment/reverse-proxy.md)
# TRUST_PROXY=1
# Graceful stop budget in seconds after SIGTERM (docs/deployment/README.md)
# SHUTDOWN_TIMEOUT=30
# Log lines: json (one object per line, the production default) or pretty; minimum level (docs/observability.md)
# LOG_FORMAT=json
# LOG_LEVEL=log
# Prometheus metrics (docs/observability.md); off by default, keep the endpoint private
# METRICS_ENABLED=true
# METRICS_PATH=/metrics
# Optional: folder with dataset archives the import page can pick from
DICTIONARY_IMPORT_DIR=/data/dictionary-imports
# Optional: which API surfaces to serve, the public rate limit and cache max-age (defaults shown)
PUBLIC_API_ENABLED=true
ADMIN_API_ENABLED=true
PUBLIC_API_RATE_LIMIT=100/60
PUBLIC_API_CACHE_MAX_AGE=3600
```
