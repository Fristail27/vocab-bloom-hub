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
on **localhost only**). A fresh instance has an empty dictionary: sign in and run _Import
dictionary_ ([`README.md`](./README.md#first-data)).

Everything the containers need comes from `.env` ([`../environment.md`](../environment.md));
`docker compose` reads the same file for its own variables (`POSTGRES_*`, the host ports,
`VBH_TAG`). Another file: `ENV_FILE=/etc/vocab-bloom-hub/.env docker compose --env-file /etc/vocab-bloom-hub/.env up -d`.

**Updating**: set the new `VBH_TAG` (or keep a floating one), then
`docker compose pull && docker compose up -d` — after a database backup, since the new server
applies its migrations on start and rollback is the backup
([`../operations.md`](../operations.md#upgrading-the-code)).

## What is in `docker-compose.yml`

| Service    | Image                                           | Notes                                                                                                                                            |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `postgres` | `postgres:17-alpine`                            | Data in the named volume `postgres-data`; `pg_isready` healthcheck; `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` from `.env`            |
| `server`   | `ghcr.io/…/vocab-bloom-hub-server:${VBH_TAG}`   | Waits for a healthy database, runs pending migrations on start, listens on `3010`; `./imports` is mounted as `DICTIONARY_IMPORT_DIR` (read-only) |
| `frontend` | `ghcr.io/…/vocab-bloom-hub-frontend:${VBH_TAG}` | The standalone Next.js build on `3000`; server-side rendering reaches the API at `http://server:3010/api` (`API_INTERNAL_URL`)                   |

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
  (environment file, database, probes, surfaces).
- **Probes**: `GET /api/health` and `GET /api/ready` ([`README.md`](./README.md#probes)); the
  compose healthchecks use the liveness one, so a container with an unreachable database stays
  up (restarting it would not help) and reports `503` on `/api/ready`.
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
