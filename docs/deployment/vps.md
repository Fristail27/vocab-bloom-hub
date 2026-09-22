# A VPS from a git checkout

The one-host installation of the project website: a checkout of the repository on a virtual
server, the images built there with `docker-compose.build.yml`, updated with `git pull` and a
rebuild. It is what https://vocab-bloom-hub.com runs on. Choose it over the published images
([`docker.md`](./docker.md)) when the website should carry a hostname of your own — its public
origin is baked in at build time — or when you run a fork.

## The host

- A Linux VPS with 2 GB of memory and 10 GB of disk for the instance with the full dictionary
  ([`../database.md`](../database.md#size)); the three image builds want another 2 GB at build
  time.
- Docker Engine with the compose plugin, git, and a user in the `docker` group (`deploy`
  below).
- A DNS name pointing at the host; two if the admin UI gets a hostname of its own.

```bash
sudo useradd -m -G docker deploy
sudo -iu deploy
git clone https://github.com/Fristail27/vocab-bloom-hub.git /opt/vocab-bloom-hub   # or: git clone <your fork>
cd /opt/vocab-bloom-hub
git checkout v1.0.0                    # a release, not main: the tags are what gets tested and published
```

## Configure

```bash
cp .env.example .env
```

In `.env`:

```dotenv
ADMIN_PASSWORD=<long random secret>
POSTGRES_PASSWORD=<another one>
COMPOSE_PROFILES=db,site                                  # the bundled Postgres and the website
NEXT_PUBLIC_SITE_URL=https://dict.example.com             # the website's public origin (build time)
NEXT_PUBLIC_BASE_API_URL=https://admin.dict.example.com/api   # the admin UI calls the API on its host
CORS_ORIGINS=https://admin.dict.example.com
TRUST_PROXY=1
```

`NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_BASE_API_URL` are build arguments: a change means a
rebuild of the website or the admin UI ([`../environment.md`](../environment.md)). The
webmaster-tools tokens go in here too, when you use them
([`docker.md`](./docker.md#search-engines)).

## Build and start

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
docker compose logs -f server           # the dictionary loads itself on the first start
curl -s localhost:3240/api/ready        # {"status":"ok"} once the import is through
```

The build takes a few minutes the first time (the workspace install, three Next.js / NestJS
builds); the import of the full dictionary a few more
([`docker.md`](./docker.md#first-start-the-dictionary-loads-itself)). The apps listen on
localhost only — `3240` (API), `3241` (admin UI), `3242` (website) — a reverse proxy publishes
them: [`examples/nginx-two-hosts.conf`](./examples/nginx-two-hosts.conf) is the two-hostname
layout (the website with the public API on one, the admin behind an address list on the
other), [`reverse-proxy.md`](./reverse-proxy.md) explains the choices.

## Update

Every update is the same four commands, worth a script (`update.sh` in the checkout):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/vocab-bloom-hub
compose="docker compose -f docker-compose.yml -f docker-compose.build.yml"

# 1. a backup: the new version may migrate the schema, and the dump is the way back
mkdir -p /var/backups/vocab-bloom-hub
$compose exec -T postgres pg_dump -U vocab -Fc vocab_bloom > "/var/backups/vocab-bloom-hub/pre-update-$(date +%F-%H%M).dump"

# 2. the new code: a release tag, or main for a fork that deploys from its branch
git fetch --tags --prune
git checkout "${1:-$(git describe --tags --abbrev=0 origin/main)}"

# 3. rebuild and switch; the old containers serve until the new images are built
$compose build
$compose up -d
docker image prune -f

# 4. did it work: readiness, the version, and the website
for i in $(seq 1 60); do curl -sf localhost:3240/api/ready >/dev/null && break; sleep 2; done
curl -s localhost:3240/api/health
curl -s -o /dev/null -w '%{http_code}\n' localhost:3242/en
```

`./update.sh v1.1.0` deploys a release, `./update.sh` the newest tag. Migrations run when the
new server starts; the admin UI tells you when a newer release exists
([`../upgrading.md`](../upgrading.md#update-notice)). A change to the documentation only needs
the website: `$compose build site && $compose up -d site`.

Rolling back is the backup plus the previous tag:

```bash
git checkout v1.0.0
docker compose -f docker-compose.yml -f docker-compose.build.yml stop server
docker compose exec -T postgres pg_restore -U vocab -d vocab_bloom --clean --if-exists < /var/backups/vocab-bloom-hub/pre-update-….dump
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## What to keep an eye on

- The state is the `postgres-data` volume and `.env`
  ([`../operations.md`](../operations.md#what-holds-state)): schedule the dumps
  ([`../database.md`](../database.md#scheduled-backups)) and copy them off the host.
- Poll `GET /api/ready` from outside ([`../operations.md`](../operations.md#external-uptime-check)).
- The metrics stack is one more `-f` file away
  ([`../observability.md`](../observability.md#prometheus--grafana-in-docker)); pass both
  `-f` files to every compose command once it is on.
- `docker image prune -f` after each update, or the images of every build pile up.
