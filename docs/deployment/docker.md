# Docker

Running Vocab Bloom Hub in containers: two published images — the API and the admin UI — and a
`docker-compose.yml` that adds Postgres (issues #316, #317).

| Image                                         | What                              |
| --------------------------------------------- | --------------------------------- |
| `ghcr.io/fristail27/vocab-bloom-hub-server`   | the API (NestJS), port 3010       |
| `ghcr.io/fristail27/vocab-bloom-hub-frontend` | the admin UI (Next.js), port 3000 |

Both are published to the GitHub Container Registry by `.github/workflows/docker.yml` for
`linux/amd64` and `linux/arm64`:

| Tag             | Built from                                | Use it for                                                      |
| --------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `1.2.3`, `1.2`  | the release tag `v1.2.3`                  | production — pin `1.2` to get patch releases, `1.2.3` to freeze |
| `latest`        | the newest stable release                 | trying it out; moves with every stable release                  |
| `0.1.0-alpha.1` | a prerelease tag `v0.1.0-alpha.1`         | exactly that prerelease; no `latest`, no floating tag           |
| `main`, `sha-…` | every push to `main` (development builds) | following development; not a release — may break between pushes |

Until the first release (#307) only `main` and `sha-…` exist, and `docker-compose.yml` defaults
to `main`.

## Quick start

No checkout needed — the compose file and the environment template are enough:

```bash
mkdir vocab-bloom-hub && cd vocab-bloom-hub
curl -fsSLO https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/.env.example -o .env
# edit .env: ADMIN_PASSWORD, POSTGRES_PASSWORD (and VBH_TAG to pin a version)
docker compose up -d               # pulls the images, starts Postgres, the API, the UI
curl -s localhost:3010/api/ready   # {"status":"ok"} once migrations ran
```

The admin UI is at `http://localhost:3000`, the API at `http://localhost:3010` (both published
on **localhost only**). The dictionary loads itself on the first start — see the next section;
`/api/ready` turns `200` once it is in.

## First start: the dictionary loads itself

A fresh database is empty, and the compose file sets `DICTIONARY_AUTO_IMPORT=true`: on a start
with no recorded dataset version the server loads the published dictionary by itself (issue
#268) — from HuggingFace, or from the newest dataset in `./imports` when one is there (an
installation without internet access, [`../offline-import.md`](../offline-import.md)). The
whole dictionary is ~300 k entries; the download is a few minutes on a typical connection and
the import a few more. While it runs:

- `docker compose logs -f server` shows the progress, stage by stage and every 10 %;
- `GET /api/ready` answers `503 { "status": "error", "reason": "importing", "percent": 37, "stage": 0 }`
  — a proxy or a script waiting for readiness keeps waiting; `GET /api/health` is `200`, the
  process is fine;
- the admin UI opens and signs in; a banner on every page shows the progress, and the _Import
  dictionary_ page waits with its button disabled;
- the public API answers, but with what has been loaded so far.

When it is done the banner reports the dataset version, `/api/ready` is `200` and
`GET /api/v1/meta` shows the counts and `dataset_version`. Later starts do nothing: the recorded
version means "loaded". An interrupted import (a restart in the middle) resumes on the next
start — records already in place are skipped.

If the load fails (HuggingFace unreachable, a download that stalls for a minute is retried
three times first) the log says why, `/api/ready` answers `503 import_failed` and the admin
banner offers the way out: import a dataset from a file, or fix the network and restart — the
next start tries again. An instance that must stay empty sets `DICTIONARY_AUTO_IMPORT=false`
in `.env`.

Everything the containers need comes from `.env` ([`../environment.md`](../environment.md));
`docker compose` reads the same file for its own variables (`POSTGRES_*`, the host ports,
`VBH_TAG`). Another file: `ENV_FILE=/etc/vocab-bloom-hub/.env docker compose --env-file /etc/vocab-bloom-hub/.env up -d`.

**Updating**: set the new `VBH_TAG` (or keep a floating one), then
`docker compose pull && docker compose up -d` — after a database backup, since the new server
applies its migrations on start and rollback is the backup
([`../operations.md`](../operations.md#upgrading-the-code)).

## What is in `docker-compose.yml`

| Service    | Image                                           | Notes                                                                                                                                                                           |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres` | `postgres:17-alpine` (profile `db`)             | Data in the named volume `postgres-data`; `pg_isready` healthcheck; `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` from `.env`; skipped for an external database (below) |
| `server`   | `ghcr.io/…/vocab-bloom-hub-server:${VBH_TAG}`   | Retries the database for a minute, runs pending migrations on start, listens on `3010`; `./imports` is mounted as `DICTIONARY_IMPORT_DIR` (read-only)                           |
| `frontend` | `ghcr.io/…/vocab-bloom-hub-frontend:${VBH_TAG}` | The standalone Next.js build on `3000`; server-side rendering reaches the API at `http://server:3010/api` (`API_INTERNAL_URL`)                                                  |

Host ports come from `SERVER_PORT` / `FRONT_PORT` in `.env` (defaults `3010` / `3000`); inside
the containers the apps always listen on `3010` / `3000`.

**Without a reverse proxy** (a workstation, a LAN) the browser calls the API under the page
origin — `http://localhost:3000/api/…` — and the frontend forwards `/api/*` to the server
(`API_INTERNAL_URL`, `app/api/[...path]/route.ts`), cookies and progress streams included. So
the quick start above signs in and imports without any proxy; the admin cookie is plain on
`http://`, which the server logs as a warning at every login.

**Reverse proxy.** The compose file publishes the apps on `127.0.0.1` on purpose: put Caddy or
nginx in front, with TLS, exactly as for the native start
([`reverse-proxy.md`](./reverse-proxy.md)) — the proxy on the host forwards `/api/*` to
`127.0.0.1:3010` directly and everything else to `127.0.0.1:3000`, so the frontend's forwarding
is never used. The admin cookie is `secure` whenever the login came over https (through the
proxy, with `TRUST_PROXY=1`).

### Bundled or external Postgres

The `postgres` service is the compose profile **`db`**. `.env.example` sets `COMPOSE_PROFILES=db`,
so `docker compose up` starts it and the server connects to it with the `POSTGRES_*`
credentials (the database is not published outside the compose network).

For a database of your own — a managed instance, a Postgres on the Docker host, an existing
dictionary — set in `.env`:

```dotenv
# COMPOSE_PROFILES=db          ← removed or empty: no bundled database
DATABASE_URL=postgres://user:password@db.example.com:5432/vocab_bloom
```

Then `docker compose up -d` starts the two apps only. A database on the Docker host itself is
`host.docker.internal`, not `localhost` (inside a container that is the container). The server
applies its migrations to that database on start and, with no dataset version recorded in it,
loads the dictionary — so an empty database of your own ends up like the bundled one. Nothing in
`docker-compose.yml` needs editing either way.

The server has no `depends_on` the database: it retries the connection for a minute at start
and, past that, exits and is restarted by compose — a bundled Postgres is ready long before, an
external one may lag behind a reboot.

## Building the images yourself

Contributors, forks and unpublished changes build from the checkout with the override file:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
# or one image at a time, from the repository root
docker build -f apps/server/Dockerfile   -t ghcr.io/fristail27/vocab-bloom-hub-server:main   .
docker build -f apps/frontend/Dockerfile -t ghcr.io/fristail27/vocab-bloom-hub-frontend:main .
```

Both are multi-stage builds on `node:24-alpine`, built from the **repository root** (the
workspace install needs every `package.json`, and the frontend imports types from the server
workspace):

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
`next build` and cannot be changed by starting the container with another value. The published
frontend image is built with the default `/api` — relative, "the API is under the same origin as
the page" — which is exactly what the reverse proxy provides, so the same image works for every
hostname. Only an API on another origin needs your own build:
`NEXT_PUBLIC_BASE_API_URL=https://api.example.com/api docker compose -f docker-compose.yml -f docker-compose.build.yml build frontend`
(and `CORS_ORIGINS` on the server). Server-side rendering does not use it inside compose; it
talks to the API through `API_INTERNAL_URL`, a runtime variable.

`.dockerignore` keeps `node_modules`, build outputs, `.env` and the local databases out of the
build context.

## How the images are published

`.github/workflows/docker.yml` builds each image on a native runner per platform
(`ubuntu-latest` for amd64, `ubuntu-24.04-arm` for arm64), pushes both by digest and merges
them into one multi-platform manifest with the tags above (`docker/metadata-action`), OCI
labels and annotations (`org.opencontainers.image.source/revision/version`) that link the
package to the repository. Authentication is the workflow's `GITHUB_TOKEN` (`packages: write`),
no secret to manage. Pull requests that touch the Dockerfiles build the amd64 image without
pushing, so a broken Dockerfile fails the check.

The packages live at <https://github.com/Fristail27?tab=packages>. GHCR creates a package
**private** on its first push; the repository owner makes it public once (package settings →
_Change visibility_) — until then `docker compose up` needs `docker login ghcr.io`.

## Operating

- **Logs**: `docker compose logs -f server` — the same startup lines as the native start
  (environment file, database, probes, surfaces), then one JSON line per request (the images run
  with `NODE_ENV=production`, so `LOG_FORMAT=json`): request id, method, path, status, duration;
  errors with their stack. Fields, `jq` recipes and shipping them to Loki or another collector:
  [`../observability.md`](../observability.md#logs).
- **Probes**: `GET /api/health` and `GET /api/ready` ([`README.md`](./README.md#probes)); the
  compose healthchecks use the liveness one, so a container with an unreachable database stays
  up (restarting it would not help) and reports `503` on `/api/ready` — as does a container
  still loading the dictionary (`importing`) or one whose load failed (`import_failed`).
- **Upgrade**: back up the database, bump `VBH_TAG`, `docker compose pull && docker compose up -d`;
  migrations run when the new server container starts, rollback is the backup
  ([`../operations.md`](../operations.md#upgrading-the-code)). The data lives in the
  `postgres-data` volume, not in the images: `docker compose down` keeps it, `docker compose down -v`
  deletes it.
- **Migrations as an explicit step** (instead of on start):
  `docker compose run --rm server node node_modules/typeorm/cli.js migration:run -d dist/src/db/data-source.js`
  — the same migrations the server would apply on start.
- **Datasets from a folder**: drop an exported archive into `./imports` on the host; the import
  page lists it ([`../offline-import.md`](../offline-import.md)).

CI builds both images from the checkout and runs `docker compose up` against them on every
pull request (`docker` job in `.github/workflows/check-pull-request.yml`), probing `/api/ready`
and the login page, so the Dockerfiles cannot rot.
