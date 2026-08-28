# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vocab Bloom Hub — a monorepo for a multilingual dictionary/vocabulary platform. Yarn 4 workspaces (`apps/*`), Node >= 24:

- `apps/frontend` — Next.js 16 (App Router) admin UI with Ant Design, Sass modules, and next-intl (en/ru locales via the `[locale]` route segment; middleware in `src/proxy.ts`).
- `apps/server` — NestJS 11 API with TypeORM. Swagger UI is served at `/api` on the running server.
- `apps/e2e` — Playwright browser tests that boot both apps against an isolated SQLite database (own tsconfig on purpose: jest and Playwright globals must not share a TS project).

## Commands

```bash
yarn dev            # run server + frontend together (concurrently)
yarn server:dev     # NestJS with watch (port SERVER_PORT, default 3010)
yarn front:dev      # Next.js dev (port FRONT_PORT, default 3000)

yarn test           # all tests (root jest config with projects: server + frontend)
yarn jest path/to/file.spec.ts            # single test file
yarn jest --selectProjects server         # only server tests (or: frontend)
yarn workspace server test:e2e            # server e2e tests (supertest, in-memory sqlite)

yarn e2e            # browser e2e: prod frontend build + Playwright (boots API :3011, frontend :3001)
yarn e2e:ui         # the same with the Playwright UI
yarn workspace e2e test                   # rerun without rebuilding the frontend

yarn workspace server openapi:generate    # rewrite apps/server/openapi/public-v1.json (committed) + admin.json (ignored)
yarn workspace server openapi:check       # fail if the committed public spec is stale (CI runs it)

yarn workspace server bench [--explain]   # latency of the hot reads on DATABASE_URL (full dictionary), see docs/performance.md
yarn workspace server test:postgres       # Postgres-only suites: query-plan guard, trigram search (CI runs them)

yarn lint / yarn lint:fix                 # ESLint 10 flat config (eslint.config.ts)
yarn format / yarn format:check           # Prettier
yarn check          # lint + format:check (run before finishing work)
```

Indexes a decorator cannot express (`COLLATE "C"`, GIN) are declared with `MANUALLY_MANAGED_INDEX` (`synchronize: false`) and created by their migration; `test:postgres` fails when a hot query stops using an index.

After changing anything under `/api/v1` (routes, DTOs, Swagger decorators, the response types in `types/public/v1`) run `openapi:generate` and commit `apps/server/openapi/public-v1.json` and `public-v1.schemas.json` (the response schemas generated from the types; a new public route must be registered in `src/openapi/public-responses.ts`) — CI and `test/public-openapi.e2e-spec.ts` compare them with the code.

Test files are `*.spec.ts(x)`, colocated with code (e.g. in `__tests__/` dirs). Server tests run in node env; frontend tests run in jsdom with styles mocked and the `@/` alias mapped.

## Environment

A single `.env` at the repo root is used by both apps (frontend scripts wrap with `dotenv -e ../../.env`; server loads it at the top of `src/main.ts`). Relevant vars: `SERVER_PORT`, `FRONT_PORT`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_BASE_API_URL`, `TRUST_PROXY` (Express `trust proxy` behind a reverse proxy, see `docs/deployment/reverse-proxy.md`), `LOG_LEVEL` (server log verbosity: `verbose`/`debug`/`log`/`warn`/`error`/`fatal`; defaults to `debug` in development, `log` otherwise).

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

Modules live in `apps/server/src/modules/` (AppModule is the root; AuthModule, EnModule, SettingsModule). The pattern inside a domain module like `EnModule`:

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
