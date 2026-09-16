# Deployment

Two ways to run an instance in production: in containers — `docker compose up` with the
published images, the easiest ([`docker.md`](./docker.md)) — or as plain Node.js processes
(this page). Either way a reverse proxy with TLS goes in front
([`reverse-proxy.md`](./reverse-proxy.md)) and Postgres holds the data
([`../database.md`](../database.md)).

| Page                                           | What it covers                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| this page                                      | Build and start the two processes, probes, graceful stop, systemd / PM2      |
| [`docker.md`](./docker.md)                     | The three images, `docker-compose.yml`, the first start, building the images |
| [`reverse-proxy.md`](./reverse-proxy.md)       | TLS, one origin for both apps, keeping the admin API private (Caddy / nginx) |
| [`examples/`](./examples/)                     | systemd units for both processes and a PM2 process file                      |
| [`../database.md`](../database.md)             | Postgres inside compose or separate, migrations, backups, size               |
| [`../environment.md`](../environment.md)       | Every environment variable                                                   |
| [`../operations.md`](../operations.md)         | Backups, upgrading, rolling back, dataset updates                            |
| [`../observability.md`](../observability.md)   | Metrics (Prometheus + Grafana) and logs                                      |
| [`../offline-import.md`](../offline-import.md) | Loading the dictionary without internet access                               |

## What production requires

- **Node.js ≥ 22.13** and Yarn 4 (`corepack enable`).
- **Postgres** — the only production database; the server refuses `NODE_ENV=production` on
  SQLite ([`../database.md`](../database.md)).
- **HTTPS** for anything beyond this host — the admin cookie is `secure` only when the login
  came over `https://`; over plain `http://` it travels unencrypted and the server logs a warning
  at every login ([`reverse-proxy.md`](./reverse-proxy.md)).

## Environment

Both apps read one `.env` at the repository root. The values that matter in production:

```dotenv
NODE_ENV=production
DATABASE_URL=postgres://user:password@db-host:5432/vocab_bloom
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<long random secret>
# the origin the browser opens; the API is served under it by the proxy
NEXT_PUBLIC_BASE_API_URL=https://dict.example.com/api
CORS_ORIGINS=https://dict.example.com
# one reverse proxy in front of the server (see reverse-proxy.md)
TRUST_PROXY=1
```

> [!IMPORTANT]
> `NEXT_PUBLIC_*` values are inlined into the frontend bundle at build time: change one, rebuild
> the frontend.

Every variable, its default and the startup checks: [`../environment.md`](../environment.md).

## Build and start

```bash
yarn install --immutable
yarn build                        # server → apps/server/dist, frontend → apps/frontend/.next (bakes NEXT_PUBLIC_* in)

yarn start                        # both processes in one terminal (concurrently); stops both when one exits
yarn start:server                 # node apps/server/dist/src/main.js — listens on SERVER_PORT (3010)
yarn start:front                  # next start — listens on PORT (3000)
yarn site:build && yarn start:site # the project website, optional — listens on SITE_PORT (3020); docker.md#the-website
```

**`ENV_FILE`** (an absolute path) loads another file than the root `.env` — for secrets kept
under `/etc`, or a build started outside the checkout. On start the server logs the file it
loaded, validates the configuration (exit code 1 with a message when something required is
missing), runs pending migrations and logs the database, CORS origins, trust-proxy setting,
probe paths, log format and enabled API surfaces. The log is stdout — JSON lines in production
([`../observability.md`](../observability.md#logs)). Both processes are stateless apart from the
database and, if used, `DICTIONARY_IMPORT_DIR`.

CI builds and starts the production build against Postgres on every pull request, probes it and
stops it with SIGTERM (`.github/scripts/production-smoke.sh`).

## Probes

Two probes under `/api` — no login, no rate limit, never cached, on even when an API surface is
switched off:

| Probe             | Answers                                                                                                                                                                                                                      | Use it for                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/health` | `200 { "status": "ok", "version": "…" }` as long as the process serves HTTP                                                                                                                                                  | liveness: restart the process when it stops answering                              |
| `GET /api/ready`  | `200 { "status": "ok" }` once migrations ran and the database answers (`SELECT 1`, 2 s budget); otherwise `503 { "status": "error", "reason": "database_unreachable" \| "shutting_down" \| "importing" \| "import_failed" }` | readiness: route traffic only while it is `200`; it turns `503` when a stop begins |

> [!NOTE]
> `503 database_unreachable` means the process is fine and Postgres is not: fix the database, not
> the server.

The frontend has no probe; `GET /en/login` answering `200` is the equivalent.

## Stopping and restarting

On **SIGTERM** (or SIGINT) the server:

1. answers `503 shutting_down` on `/api/ready`, so a load balancer stops sending requests;
2. closes the listener and lets the requests in flight finish;
3. closes the Postgres pool and exits with code 0.

All of it within **`SHUTDOWN_TIMEOUT`** seconds (30 by default); past that the log says
`forcing exit` and the exit code is 1.

> [!IMPORTANT]
> Give the process manager a stop timeout _above_ this budget (`TimeoutStopSec` in systemd,
> `kill_timeout` in PM2) or it kills first.

Restarting is the manager's job: `Restart=always` (systemd), `autorestart` (PM2). A server that
cannot start — missing configuration, unreachable database — exits with code 1 and the manager
retries; `journalctl` shows why. A deploy is: back up, ship the new build, restart both
processes, watch `/api/ready` turn `200` ([`../operations.md`](../operations.md#upgrading-the-code)).
There is a pause between the old and the new process; zero downtime needs two server instances
behind the proxy, which this guide does not cover.

> [!WARNING]
> Run **one server instance per database**: the rate-limit buckets, the login replay protection
> and the pending export downloads live in process memory. Replicas work but each counts the
> limits on its own, and an export download that lands on another replica fails.

## Process managers

Ready-to-adapt files in [`examples/`](./examples/):

- **systemd** — [`vocab-bloom-hub-server.service`](./examples/vocab-bloom-hub-server.service)
  and [`vocab-bloom-hub-frontend.service`](./examples/vocab-bloom-hub-frontend.service): run
  `node` directly (no yarn in between, so the signal and the exit code are the process's own),
  `ENV_FILE` / `EnvironmentFile=` pointing at `/etc/vocab-bloom-hub/.env`, `TimeoutStopSec`
  above `SHUTDOWN_TIMEOUT`, `Restart=always`. Copy to `/etc/systemd/system/`, adjust paths and
  user, `systemctl daemon-reload && systemctl enable --now vocab-bloom-hub-server vocab-bloom-hub-frontend`.
- **PM2** — [`ecosystem.config.cjs`](./examples/ecosystem.config.cjs): both apps from one file,
  `pm2 start docs/deployment/examples/ecosystem.config.cjs` after `yarn build`, then
  `pm2 save && pm2 startup` to come back after a reboot.

Any supervisor that forwards SIGTERM to `yarn start` works the same.

## First data

A fresh instance has an empty dictionary. Two ways to fill it:

- **By itself, on first start** — `DICTIONARY_AUTO_IMPORT=true` in `.env` (on in the compose
  file, off by default for a native start): the server loads the published dataset from
  HuggingFace — or the newest dataset in `DICTIONARY_IMPORT_DIR` — in the background, logs the
  progress and answers `503 importing` on `/api/ready` until it is done
  ([`docker.md`](./docker.md#first-start-the-dictionary-loads-itself)).
- **From the admin UI** — _Import dictionary_: from HuggingFace, or from an archive when the
  host has no internet access ([`../offline-import.md`](../offline-import.md)). The import
  streams its progress for a few minutes; the proxy must not buffer that stream. One import at
  a time; a second one is refused with `409`.

## Upgrading

Back up the database, pull the new version, `yarn install --immutable`, `yarn build`, restart both
processes: pending migrations run on the server's start. Rolling back is restoring that backup —
once the new server has run its migrations, the previous version no longer matches the schema.
The full procedure: [`../operations.md`](../operations.md#upgrading-the-code).
