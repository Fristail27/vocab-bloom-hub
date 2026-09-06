# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vocab Bloom Hub — a monorepo for a multilingual dictionary/vocabulary platform. Yarn 4 workspaces (`apps/*`, `packages/*`), Node >= 24:

- `apps/frontend` — Next.js 16 (App Router) admin UI with Ant Design, Sass modules, and next-intl (en/ru locales via the `[locale]` route segment; middleware in `src/proxy.ts`).
- `apps/site` — Next.js 16 project website (next-intl en/ru, Sass modules, no Ant Design): the landing, the documentation rendered at build time from the repository's Markdown (`src/content/registry.ts` maps files to routes, links between the files are rewritten), the public API reference and the playground generated from `apps/server/openapi/public-v1.json` (`src/content/openapi.ts`, `playground.ts`), and server-rendered word pages over the public API (`src/core/dictionary.ts`; `API_INTERNAL_URL`, the same `/api/*` forwarding route as the frontend). Types from `server/types`. Served next to an instance as the `site` compose profile (off by default), image `vocab-bloom-hub-site`, port `SITE_PORT` (3020).
- `apps/server` — NestJS 11 API with TypeORM. Swagger UI is served at `/api` on the running server.
- `apps/e2e` — Playwright browser tests that boot both apps against an isolated SQLite database (own tsconfig on purpose: jest and Playwright globals must not share a TS project).
- `packages/npm-sdk` — `@vocab-bloom-hub/client`, the typed Node.js / browser client of the public API: types generated from `apps/server/openapi/public-v1.json` (`src/generated/openapi.ts`, committed) plus a hand-written wrapper; tsup build (ESM + CJS + d.ts), no runtime dependencies. Not published to npm before the alpha (#308).
- `packages/python-sdk` — `vocab-bloom-hub` on PyPI (import `vocab_bloom_hub`), the Python client: pydantic models generated from the same spec (`src/vocab_bloom_hub/_generated/models.py`, committed), sync + async clients on httpx; managed with `uv` (`uv sync`, `uv run ruff/mypy/pytest`), Python ≥ 3.10. The live tests start the server through `yarn workspace server fixture:public-api`. Not published before the alpha (#310).

## Commands

```bash
yarn dev            # run server + frontend + site together (concurrently)
yarn server:dev     # NestJS with watch (port SERVER_PORT, default 3010)
yarn front:dev      # Next.js dev (port FRONT_PORT, default 3000)
yarn site:dev       # website dev (port SITE_PORT, default 3020); site:build / start:site for the production build
yarn build          # production build of both apps (server → apps/server/dist, frontend → .next)
yarn start          # start both production builds (concurrently); start:server / start:front for one
                    # CI boots them against Postgres and probes /api/ready (.github/scripts/production-smoke.sh)

docker compose up -d                      # server + frontend from the GHCR images, plus the bundled Postgres when
                                          # COMPOSE_PROFILES=db (the .env.example default; docs/deployment/docker.md)
                                          # and the website when the profile list has `site` (COMPOSE_PROFILES=db,site);
                                          # an external database: drop the profile, set DATABASE_URL. VBH_TAG picks the image tag
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build   # build from this checkout instead (CI does this)
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d   # + local Prometheus & Grafana with a provisioned dashboard; enables the server metrics (docs/observability.md)
                                          # images are published by .github/workflows/docker.yml: main → `main` + `sha-…`, tags v* → semver + latest

yarn test           # all tests (root jest config with projects: server + frontend + site + sdk)
yarn jest path/to/file.spec.ts            # single test file
yarn jest --selectProjects server         # only server tests (or: frontend, site, sdk)
yarn workspace server test:e2e            # server e2e tests (supertest, in-memory sqlite)

yarn e2e            # browser e2e: prod frontend build + Playwright (boots API :3011, frontend :3001)
yarn e2e:ui         # the same with the Playwright UI
yarn e2e:site       # browser e2e of the website (boots API :3012, site :3021); e2e:site:ui for the UI
yarn workspace e2e test                   # rerun without rebuilding the frontend (test:site for the site suite)

yarn workspace server openapi:generate    # rewrite apps/server/openapi/public-v1.json (committed) + admin.json (ignored)
yarn workspace server openapi:check       # fail if the committed public spec is stale (CI runs it)

yarn workspace @vocab-bloom-hub/client generate        # regenerate the SDK types from the public spec (commit the result)
yarn workspace @vocab-bloom-hub/client generate:check  # fail if the generated SDK types are stale (CI runs it)
yarn workspace @vocab-bloom-hub/client build / test    # SDK build; unit tests + the client against the real server

cd packages/python-sdk && uv sync                          # Python SDK environment (.venv)
uv run python scripts/generate_models.py [--check]         # pydantic models from the public spec (commit the result)
uv run ruff check . && uv run mypy && uv run pytest        # Python SDK lint, types, tests (live tests boot the server via yarn)

yarn workspace server bench [--explain]   # latency of the hot reads on DATABASE_URL (full dictionary), see docs/performance.md
yarn workspace server test:postgres       # Postgres-only suites: query-plan guard, trigram search (CI runs them)

yarn lint / yarn lint:fix                 # ESLint 10 flat config (eslint.config.ts)
yarn format / yarn format:check           # Prettier
yarn peers:check    # fail on unmet peer dependencies not listed in scripts/check-peer-requirements.mjs (CI runs it)
yarn check          # lint + format:check + peers:check (run before finishing work)
```

Indexes a decorator cannot express (`COLLATE "C"`, GIN) are declared with `MANUALLY_MANAGED_INDEX` (`synchronize: false`) and created by their migration; `test:postgres` fails when a hot query stops using an index.

After changing anything under `/api/v1` (routes, DTOs, Swagger decorators, the response types in `types/public/v1`) run `openapi:generate`, then `yarn workspace @vocab-bloom-hub/client generate` and `uv run python scripts/generate_models.py` in `packages/python-sdk`, and commit `apps/server/openapi/public-v1.json`, `public-v1.schemas.json`, `packages/npm-sdk/src/generated/openapi.ts` and `packages/python-sdk/src/vocab_bloom_hub/_generated/models.py` (the response schemas generated from the types; a new public route must be registered in `src/openapi/public-responses.ts`) — CI and `test/public-openapi.e2e-spec.ts` compare them with the code.

Test files are `*.spec.ts(x)`, colocated with code (e.g. in `__tests__/` dirs). Server tests run in node env; frontend tests run in jsdom with styles mocked and the `@/` alias mapped.

## Environment

A single `.env` at the repo root is used by both apps (frontend scripts wrap with `dotenv -e ../../.env`; server loads it at the top of `src/main.ts`). Relevant vars: `SERVER_PORT`, `FRONT_PORT`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_BASE_API_URL`, `TRUST_PROXY` (Express `trust proxy` behind a reverse proxy, see `docs/deployment/reverse-proxy.md`), `METRICS_ENABLED` / `METRICS_PATH` (Prometheus endpoint, `docs/observability.md`), `LOG_LEVEL` (server log verbosity: `verbose`/`debug`/`log`/`warn`/`error`/`fatal`; defaults to `debug` in development, `log` otherwise), `LOG_FORMAT` (`json` — one object per line, the production default — or `pretty`; every line goes through pino via `nestjs-pino`, `src/core/logging/`, with a request line per request carrying `x-request-id`, probes excluded; `docs/observability.md#logs`), `ENV_FILE` (absolute path of the env file to load instead of the root `.env`; the server exits when it is named but unreadable), `SHUTDOWN_TIMEOUT` (seconds a graceful SIGTERM stop may take before the watchdog forces exit, default 30), `DB_POOL_SIZE` / `DB_POOL_IDLE_TIMEOUT` (Postgres pool: max connections, default 10, and idle-timeout seconds, default 10; ignored on SQLite — `src/core/utils/db-pool.ts`), `SUGGESTIONS_RATE_LIMIT` (reports per client on the public POST /api/v1/suggestions — the word pages' "Report a mistake", moderated on the admin Suggestions page; `<requests>/<seconds>`, default 5/3600), `AUDIT_RETENTION_DAYS` (days the audit journal of admin changes is kept — `AuditModule`, one row per admin mutation / import run with a before/after diff, `GET /api/en/audit` + the admin History page; default 90, 0 = forever). Probes: `GET /api/health` (liveness) and `GET /api/ready` (readiness, 503 without the database, while stopping, while the first-start import runs or after it failed) — `HealthModule`, outside both API surfaces, see `docs/deployment/README.md`. `DICTIONARY_AUTO_IMPORT` (off by default, on in `docker-compose.yml`): `DictionaryBootstrapService` loads the dictionary on a start with no recorded dataset version (from `DICTIONARY_IMPORT_DIR` or HuggingFace; `DICTIONARY_DATASET_VERSION` pins a revision tag); one import at a time (`ImportStatusService`, 409 `import_in_progress`), status at `GET /api/en/dictionary/import/status`; the import pipeline reports through `ImportProgressSink` (HTTP NDJSON stream or the log).

Database: the `DATABASE_URL` scheme selects the driver — `postgres://` connects to Postgres, `sqlite:<path>` (e.g. `sqlite:./e2e.sqlite`, `sqlite::memory:`) runs better-sqlite3 on that file, any other scheme fails startup. When unset, it falls back to `dev.sqlite` at the repo root. The two modes manage the schema differently (config in `apps/server/src/db/typeorm-options.ts`):

- **SQLite (dev fallback)** — `synchronize: true`, entity changes reshape the schema automatically. No migrations. Development and tests only: on the full dictionary its search tiers take ~1 s per request (`docs/performance.md`).
- **Postgres** — the only supported production database (the full dictionary needs its indexes, see `docs/performance.md`); `synchronize` is off; the schema is managed by TypeORM migrations in `apps/server/src/db/migrations/`, which run automatically on server start (`migrationsRun`). After changing an entity, generate a migration against a Postgres instance with the current schema and register the new class in `src/db/migrations/index.ts` (the CLI and the runtime read that explicit list, not a glob):

```bash
DATABASE_URL=postgres://... yarn workspace server migration:generate src/db/migrations/MyChange
yarn workspace server migration:run / migration:revert / migration:show   # need DATABASE_URL too
```

For a pre-existing database whose tables were created by the old `synchronize`, mark the baseline as applied without executing it: `yarn workspace server migration:run --fake`. Full workflow (hand-written migrations, deployment, troubleshooting): `docs/migrations.md`.

## Architecture

### Shared types: frontend imports from the server workspace

`apps/server/types/` (API request/response types, enums, `ErrorResT`) and `apps/server/core/` (constants like `ErrorCodes`, utils) are the single source of truth shared across apps. The frontend imports them through the workspace package name, e.g. `import { ErrorResT } from 'server/types'`. When changing an API contract, update these types — both apps consume them.

### Server: domain modules with sub-controller/service pairs

Modules live in `apps/server/src/modules/` (AppModule is the root; AuthModule, EnModule, SettingsModule, SuggestionsModule, PublicApiModule, AuditModule, HealthModule, MetricsModule). The pattern inside a domain module like `EnModule`:

- `entities/` — TypeORM entities (EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation), registered both in the module's `forFeature` and in AppModule's `forRootAsync`.
- `modules/<Feature>/` — feature folders (EnSearch, EnImportDictionary, EnMeaning, ...) each holding a controller + service (+ dto/, utils/). These are **not** separate Nest modules; their controllers/providers are registered in the parent `en.module.ts`.

A global `ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true, transform: true` — request DTOs must declare every field with class-validator decorators or requests fail.

### Auth: single admin from env

There is no user table. `AuthService` derives hashes from the `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars, issues a JWT with the admin role (signed via `core/utils/auth`, `jsonwebtoken`), and sets it as an httpOnly `bearer` cookie (`secure` in production). `AdminGuard` in `AuthModule` validates the token on protected routes, reading it from the Authorization header or the cookie. Browser requests carry the cookie via `credentials: 'include'`; during SSR the `Server*Api` wrappers forward the incoming cookie as a Bearer header.

### Frontend API layer: error unions, not exceptions

API clients in `src/core/api/` are static classes extending `AbstractBaseApi` (one class per server domain: AuthApi, EnApi, SettingsApi). Requests never throw — every method returns `T | ErrorResT`, and callers must check the `error` flag. Follow this pattern when adding endpoints. Base URL comes from `NEXT_PUBLIC_BASE_API_URL`.

Reusable presentational primitives live in `src/core/ui/`; app-level composite components in `src/components/`; route-specific components in `_components/` folders next to their route.

## Conventions

- Commit messages follow `feat:`/`fix:`/`docs:` style; branches like `feature/...`, `fix/...` (see CONTRIBUTING.md). PRs go to `main`.
- ESLint config is split in `eslint/` (base/next/nest) and composed in root `eslint.config.ts`; husky + lint-staged run on commit.
- Some existing comments are in Russian; that's normal for this codebase.
