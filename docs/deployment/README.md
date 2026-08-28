# Deployment

How to run a Vocab Bloom Hub instance in production. There is no Docker image or hosted build
yet (tracked in #265); both apps are deployed as plain Node.js processes behind a reverse proxy.

| Page                                           | What it covers                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| this page                                      | Building and starting the two processes, what production requires                                   |
| [`reverse-proxy.md`](./reverse-proxy.md)       | TLS, routing both apps on one host, keeping the admin API private (Caddy / nginx), `TRUST_PROXY`    |
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
yarn workspace server build       # apps/server/dist
yarn workspace frontend build     # apps/frontend/.next (bakes NEXT_PUBLIC_* in)

yarn workspace server start:prod  # node dist/main — listens on SERVER_PORT (3010)
yarn workspace frontend start     # next start — listens on FRONT_PORT (3000)
```

On start the server loads `.env`, validates the configuration (exits with code 1 and a message
when something required is missing), runs pending migrations, and logs the resolved database,
CORS origins, trust-proxy setting and which API surfaces are enabled. Run the two commands under
a process manager (systemd, pm2) so they restart with the host; both are stateless apart from the
database and, if used, `DICTIONARY_IMPORT_DIR`.

## First data

A fresh instance has an empty dictionary. Sign in to the admin UI and run _Import dictionary_ —
from the published HuggingFace dataset, or from an archive when the host has no internet access
([`../offline-import.md`](../offline-import.md)). The import streams its progress for a few
minutes; the proxy must not buffer that stream (covered in the proxy guide).

## Upgrading

Pull the new version, `yarn install --immutable`, rebuild both apps, restart the processes:
pending migrations run on the server's start. Backup, restore and rollback are tracked in #282.
