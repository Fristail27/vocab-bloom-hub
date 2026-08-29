# Deployment

How to run a Vocab Bloom Hub instance in production: as plain Node.js processes (this page) or
in containers ([`docker.md`](./docker.md) — `docker compose up` with the published images and
Postgres included). Either way a reverse proxy with TLS goes in front.

| Page                                           | What it covers                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| this page                                      | Building and starting the two processes, probes, graceful stop, process managers                    |
| [`docker.md`](./docker.md)                     | The two images, `docker-compose.yml` with Postgres, build arguments, upgrading containers           |
| [`examples/`](./examples/)                     | systemd units for both processes and a PM2 process file                                             |
| [`reverse-proxy.md`](./reverse-proxy.md)       | TLS, routing both apps on one host, keeping the admin API private (Caddy / nginx), `TRUST_PROXY`    |
| [`../operations.md`](../operations.md)         | Day two: what to back up, database backup vs dictionary export, upgrading and rolling back, sizing  |
| [`../environment.md`](../environment.md)       | Every environment variable, startup validation                                                      |
| [`../migrations.md`](../migrations.md)         | Postgres schema migrations: automatic run on start, adopting an old auto-synced database, rollbacks |
| [`../offline-import.md`](../offline-import.md) | Loading the dictionary on an instance without internet access                                       |

## What production requires

- **Node.js ≥ 24** and Yarn 4 (`corepack enable`) on the host.
- **Postgres** — the only supported production database; the server refuses to start with
  `NODE_ENV=production` on SQLite. The full dictionary needs the indexes the migrations create
  (see [`../performance.md`](../performance.md)).
- **TLS in front of both apps** — the admin session cookie is `secure` in production and is not
  sent over plain HTTP, so the admin UI only works on `https://`. The proxy also routes the two
  processes under one origin; see [`reverse-proxy.md`](./reverse-proxy.md).

## Environment

Both apps read a single `.env` at the repository root (or the process environment). The values
that matter in production:

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

`NEXT_PUBLIC_*` values are inlined into the frontend bundle at build time — changing them means
rebuilding the frontend. The full list, defaults and the checks the server runs at startup are in
[`../environment.md`](../environment.md).

## Build and start

```bash
yarn install --immutable
yarn build                        # server → apps/server/dist, frontend → apps/frontend/.next (bakes NEXT_PUBLIC_* in)

yarn start                        # both processes in one terminal (concurrently); stops both when one exits
yarn start:server                 # node apps/server/dist/src/main.js — listens on SERVER_PORT (3010)
yarn start:front                  # next start — listens on PORT (3000)
```

The environment comes from the root `.env` or from the file named by **`ENV_FILE`** — an
absolute path, for a checkout that keeps its secrets under `/etc` or a build that runs outside
the repository tree ([`../environment.md`](../environment.md)). On start the server logs which
file it loaded, validates the configuration (exits with code 1 and a message when something
required is missing or `ENV_FILE` cannot be read), runs pending migrations, and logs the
resolved database, CORS origins, trust-proxy setting, probe paths and which API surfaces are
enabled. Both processes are stateless apart from the database and, if used,
`DICTIONARY_IMPORT_DIR`.

CI starts the production build the same way on every pull request — `yarn build`, `yarn start`
against Postgres, the probes and the login page, then a SIGTERM — so this path cannot rot
(`.github/scripts/production-smoke.sh`).

## Probes

The server answers two probes under `/api`, so the proxy configs route them like every other API
path; they need no login, are not rate-limited, ignore the `PUBLIC_API_ENABLED` /
`ADMIN_API_ENABLED` switches and are never cached:

| Probe             | Answers                                                                                                                                                                                    | Use it for                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `GET /api/health` | `200 { "status": "ok", "version": "…" }` as long as the process serves HTTP                                                                                                                | liveness: restart the process when it stops answering                                    |
| `GET /api/ready`  | `200 { "status": "ok" }` once migrations ran and the database answers (`SELECT 1`, 2 s budget); otherwise `503 { "status": "error", "reason": "database_unreachable" \| "shutting_down" }` | readiness: route traffic only while it is `200`; it turns `503` the moment a stop begins |

A `503` with `database_unreachable` means the process is up but Postgres is not: restarting the
server does not help, the database does. The frontend has no probe of its own; `GET /en/login`
answering `200` is the equivalent check.

## Stopping and restarting

Stopping is the process manager's job; the server cooperates. On **SIGTERM** (or SIGINT) it:

1. reports `503 shutting_down` on `/api/ready`, so a load balancer stops sending new requests;
2. closes the listener — no new connections — and lets the requests in flight finish;
3. closes the Postgres pool and exits with code 0.

Everything must fit in **`SHUTDOWN_TIMEOUT`** seconds (30 by default). A stop that takes longer —
a dictionary import in progress, a stuck connection — ends with `forcing exit` in the log and
exit code 1 instead of hanging until the manager's SIGKILL. Give the manager a stop timeout
_above_ this budget (`TimeoutStopSec` in systemd, `kill_timeout` in PM2) or it kills first.

Restarting is the manager's job too: `Restart=always` (systemd), `autorestart` (PM2). The server
exits with code 1 when it cannot start — missing configuration, a database it cannot reach (the
migrations fail) — and the manager retries after its delay; `journalctl` shows why. A deploy is
therefore: back up, ship the new build, restart both processes, watch `/api/ready` turn `200`
([`../operations.md`](../operations.md#upgrading-the-code)). One process cannot be upgraded
without a pause; zero-downtime needs two server instances behind the proxy, taken out of
rotation by their readiness probe in turn — a topology this guide does not cover.

## Process managers

Ready-to-adapt files in [`examples/`](./examples/):

- **systemd** — [`vocab-bloom-hub-server.service`](./examples/vocab-bloom-hub-server.service)
  and [`vocab-bloom-hub-frontend.service`](./examples/vocab-bloom-hub-frontend.service): run
  `node` directly (no yarn in between, so the signal and the exit code are the process's own),
  `ENV_FILE` / `EnvironmentFile=` pointing at `/etc/vocab-bloom-hub/.env`, `TimeoutStopSec`
  above `SHUTDOWN_TIMEOUT`, `Restart=always`. Copy to `/etc/systemd/system/`, adjust paths and
  user, `systemctl daemon-reload && systemctl enable --now vocab-bloom-hub-server
vocab-bloom-hub-frontend`.
- **PM2** — [`ecosystem.config.cjs`](./examples/ecosystem.config.cjs): both apps from one file,
  `pm2 start docs/deployment/examples/ecosystem.config.cjs` after `yarn build`, then
  `pm2 save && pm2 startup` to come back after a reboot.

Neither file is required: `yarn start` under any supervisor that forwards SIGTERM works the same.

## First data

A fresh instance has an empty dictionary. Two ways to fill it:

- **By itself, on first start** — set `DICTIONARY_AUTO_IMPORT=true` in `.env` (the compose
  file does; a native start leaves it off): with no dataset version recorded, the server loads
  the published dataset from HuggingFace — or the newest dataset in `DICTIONARY_IMPORT_DIR` —
  in the background, logs the progress and answers `503 importing` on `/api/ready` until it is
  done; a failed load is retried on the next start
  ([`docker.md`](./docker.md#first-start-the-dictionary-loads-itself)).
- **From the admin UI** — sign in and run _Import dictionary_: from HuggingFace, or from an
  archive when the host has no internet access ([`../offline-import.md`](../offline-import.md)).
  The import streams its progress for a few minutes; the proxy must not buffer that stream
  (covered in the proxy guide). One import runs at a time; a second one is refused with `409`.

## Upgrading

Back up the database first, then pull the new version, `yarn install --immutable`, rebuild both
apps and restart the processes: pending migrations run on the server's start and bind the
database to the new version. Rolling back means restoring that backup — the full procedure, what
to back up and how dataset updates differ from code updates are in
[`../operations.md`](../operations.md).
