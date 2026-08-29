# Docker

Running Vocab Bloom Hub in containers (issue #316): two images built from the repository —
the API and the admin UI — and a `docker-compose.yml` that adds Postgres. Images are not
published yet; `docker compose` builds them locally (publishing to GHCR is #317).

## Quick start

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git && cd vocab-bloom-hub
cp .env.example .env            # set ADMIN_PASSWORD and POSTGRES_PASSWORD
docker compose up -d --build    # builds both images (a few minutes the first time)
curl -s localhost:3010/api/ready   # {"status":"ok"} once migrations ran
```

The admin UI is at `http://localhost:3000`, the API at `http://localhost:3010` (both published
on **localhost only**). A fresh instance has an empty dictionary: sign in and run _Import
dictionary_ ([`README.md`](./README.md#first-data)).

Everything the containers need comes from `.env` ([`../environment.md`](../environment.md));
`docker compose` reads the same file for its own variables (`POSTGRES_*`, the host ports).
Another file: `ENV_FILE=/etc/vocab-bloom-hub/.env docker compose --env-file /etc/vocab-bloom-hub/.env up -d`.

## What is in `docker-compose.yml`

| Service    | Image                      | Notes                                                                                                                                            |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `postgres` | `postgres:17-alpine`       | Data in the named volume `postgres-data`; `pg_isready` healthcheck; `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` from `.env`            |
| `server`   | `apps/server/Dockerfile`   | Waits for a healthy database, runs pending migrations on start, listens on `3010`; `./imports` is mounted as `DICTIONARY_IMPORT_DIR` (read-only) |
| `frontend` | `apps/frontend/Dockerfile` | `next start` of the standalone build on `3000`; server-side rendering reaches the API at `http://server:3010/api` (`API_INTERNAL_URL`)           |

Host ports come from `SERVER_PORT` / `FRONT_PORT` in `.env` (defaults `3010` / `3000`); inside
the containers the apps always listen on `3010` / `3000`.

**Reverse proxy.** The compose file publishes the apps on `127.0.0.1` on purpose: put Caddy or
nginx in front, with TLS, exactly as for the native start
([`reverse-proxy.md`](./reverse-proxy.md)) — the proxy on the host forwards to
`127.0.0.1:3010` and `127.0.0.1:3000`. The admin cookie is `secure` whenever the login came over
https (through the proxy, with `TRUST_PROXY=1`), and plain on `http://localhost` — so signing in
works on a workstation without certificates, and a production instance over plain http logs a
warning at every login.

**External Postgres.** Set `DATABASE_URL` in `.env` to the external instance and remove the
`postgres` service and the `depends_on` from the compose file (or keep both and ignore the
container).

## The images

Both are multi-stage builds on `node:24-alpine`, built from the **repository root** (the
workspace install needs every `package.json`, and the frontend imports types from the server
workspace):

```bash
docker build -f apps/server/Dockerfile   -t vocab-bloom-hub-server   .
docker build -f apps/frontend/Dockerfile -t vocab-bloom-hub-frontend .
```

- **server** — a full workspace install with the native toolchain, the Nest build, then a
  runtime stage holding `dist/` and only the production dependencies of the `server` workspace
  (`yarn workspaces focus server --production`). Runs as `node` with `node dist/src/main.js` as
  the command: SIGTERM reaches the server directly and it drains within `SHUTDOWN_TIMEOUT`
  ([`README.md`](./README.md#stopping-and-restarting)); `stop_grace_period` in the compose file
  stays above that. `HEALTHCHECK` on `GET /api/health`.
- **frontend** — `next build` with `output: 'standalone'` (traced from the monorepo root), the
  runtime stage holds `server.js`, the traced `node_modules`, `.next/static` and `public`.
  `HEALTHCHECK` on `GET /en/login`.

**`NEXT_PUBLIC_BASE_API_URL` is a build argument**: it is inlined into the browser bundle by
`next build` and cannot be changed by starting the container with another value. The default
`/api` is relative — "the API is under the same origin as the page" — which is exactly what the
reverse proxy provides, so the default image works for every hostname. Only an API on another
origin needs a rebuild: `docker compose build --build-arg NEXT_PUBLIC_BASE_API_URL=https://api.example.com/api frontend`
(and `CORS_ORIGINS` on the server). Server-side rendering does not use it inside compose; it
talks to the API through `API_INTERNAL_URL`, a runtime variable.

`.dockerignore` keeps `node_modules`, build outputs, `.env` and the local databases out of the
build context.

## Operating

- **Logs**: `docker compose logs -f server` — the same startup lines as the native start
  (environment file, database, probes, surfaces).
- **Probes**: `GET /api/health` and `GET /api/ready` ([`README.md`](./README.md#probes)); the
  compose healthchecks use the liveness one, so a container with an unreachable database stays
  up (restarting it would not help) and reports `503` on `/api/ready`.
- **Upgrade**: back up the database, `git pull`, `docker compose up -d --build`; migrations run
  when the new server container starts, rollback is the backup
  ([`../operations.md`](../operations.md#upgrading-the-code)). The data lives in the
  `postgres-data` volume, not in the images: `docker compose down` keeps it, `docker compose down -v`
  deletes it.
- **Migrations as an explicit step** (instead of on start):
  `docker compose run --rm server node node_modules/typeorm/cli.js migration:run -d dist/src/db/data-source.js`
  — the same migrations the server would apply on start.
- **Datasets from a folder**: drop an exported archive into `./imports` on the host; the import
  page lists it ([`../offline-import.md`](../offline-import.md)).

CI builds both images and runs `docker compose up` against them on every pull request
(`docker` job in `.github/workflows/check-pull-request.yml`), probing `/api/ready` and the login
page, so the Dockerfiles cannot rot.
