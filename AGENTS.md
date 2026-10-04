# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, Gemini CLI, Copilot, …) working in this repository. `CLAUDE.md` only imports this file; edit this one.

## What this is

Vocab Bloom Hub — a monorepo for a multilingual dictionary/vocabulary platform. Yarn 4 workspaces (`apps/*`, `packages/*`), Node >= 22.13 to run, 24.9+ for the Jest suites (NestJS 12 is ESM-only; CI runs them on 24, everything else on 22):

- `apps/frontend` — Next.js 16 (App Router) admin UI with Ant Design, Sass modules, and next-intl (eight interface languages via the `[locale]` route segment, Arabic right-to-left; middleware in `src/proxy.ts`).
- `apps/site` — Next.js 16 project website, published at https://vocab-bloom-hub.com (`PROJECT_WEBSITE_URL` in `apps/server/core/constants/project_links.ts`; next-intl, the eight interface languages, Sass modules, no Ant Design): the landing, the documentation rendered at build time from the repository's Markdown (`src/content/registry.ts` maps files to routes and their translated versions — the README's getting-started section in every language, a few pages in Russian — links between the files are rewritten), the public API reference and the playground generated from `apps/server/openapi/public-v1.json` (`src/content/openapi.ts`, `playground.ts`; the request snippets under every endpoint of the reference — curl, JavaScript, Python, Go, PHP and the two SDKs — come from `src/content/snippets/`, one module per language, its README says how to add one), and server-rendered word pages over the public API — a tab per dataset that holds the headword, the history of edits of a word, flags as pictures of the site's own in `public/flags` — and the terms of the served dataset at `/dataset-terms` (`src/core/dictionary.ts`; `API_INTERNAL_URL`, the same `/api/*` forwarding route as the frontend). Types from `server/types`. Served next to an instance as the `site` compose profile (off by default), image `vocab-bloom-hub-site`, port `SITE_PORT` (3020).
- `apps/server` — NestJS 12 API with TypeORM. Swagger UI is served at `/api` on the running server.
- `apps/e2e` — Playwright browser tests that boot both apps against an isolated SQLite database (own tsconfig on purpose: jest and Playwright globals must not share a TS project).
- `packages/npm-sdk` — `@vocab-bloom-hub/client`, the typed Node.js / browser client of the public API: types generated from `apps/server/openapi/public-v1.json` (`src/generated/openapi.ts`, committed) plus a hand-written wrapper; tsup build (ESM + CJS, a declaration file per format; `pack:check` = publint + arethetypeswrong gates the exports map), no runtime dependencies. On npm since `v0.1.0-alpha.1`, stable since `v1.0.0` (`latest`; a prerelease publishes under its channel dist-tag); `SDK_VERSION` / `USER_AGENT` come from `package.json` at build time.
- `packages/python-sdk` — `vocab-bloom-hub` on PyPI (import `vocab_bloom_hub`), the Python client: pydantic models generated from the same spec (`src/vocab_bloom_hub/_generated/models.py`, committed), sync + async clients on httpx; managed with `uv` (`uv sync`, `uv run ruff/mypy/pytest`), Python ≥ 3.10. The live tests start the server through `yarn workspace server fixture:public-api`. On PyPI since `v0.1.0-alpha.1`, stable since `v1.0.0` (`--pre` only for prereleases); `__version__` is read from the installed metadata (`_version.py`), `pyproject.toml` is the only Python version source.

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
                                          # an external database: drop the profile, set DATABASE_URL. VBH_TAG picks the image tag;
                                          # host ports 3240 (API) / 3241 (admin) / 3242 (site), 3243 / 3244 with the observability overlay
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build   # build from this checkout instead (CI does this)
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d   # + local Prometheus & Grafana with a provisioned dashboard; enables the server metrics (docs/observability.md)
                                          # images are published by .github/workflows/docker.yml: main → `main` + `sha-…`, tags v* → semver + latest

yarn test           # all tests (root jest config with projects: server + frontend + site + sdk)
yarn jest path/to/file.spec.ts            # single test file
yarn jest --selectProjects server         # only server tests (or: frontend, site, sdk)
yarn workspace server test:cov            # server unit tests with coverage over every source file; CI fails below the thresholds in apps/server/jest.config.ts
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
yarn workspace @vocab-bloom-hub/client pack:check      # publint + arethetypeswrong on the packed tarball (CI, release)

cd packages/python-sdk && uv sync                          # Python SDK environment (.venv)
uv run python scripts/generate_models.py [--check]         # pydantic models from the public spec (commit the result)
uv run ruff check . && uv run mypy && uv run pytest        # Python SDK lint, types, tests (live tests boot the server via yarn)

yarn workspace server convert <source> --input <file> --out <folder>   # a converter without an instance: the file a public source
                                          # distributes (wiktionary: the kaikki.org .jsonl.gz; wordnet: the release zip or tar.gz,
                                          # --cmudict for IPA) into a dataset of the project's format. An admin installs a dataset
                                          # on the datasets page instead; src/converters/README.md says how to add a source

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

A single `.env` at the repo root is used by both apps (frontend scripts wrap with `dotenv -e ../../.env`; server loads it at the top of `src/main.ts`). Relevant vars: `SERVER_PORT`, `FRONT_PORT`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_BASE_API_URL`, `TRUST_PROXY` (Express `trust proxy` behind a reverse proxy, see `docs/deployment/reverse-proxy.md`), `METRICS_ENABLED` / `METRICS_PATH` (Prometheus endpoint, `docs/observability.md`), `LOG_LEVEL` (server log verbosity: `verbose`/`debug`/`log`/`warn`/`error`/`fatal`; defaults to `debug` in development, `log` otherwise), `LOG_FORMAT` (`json` — one object per line, the production default — or `pretty`; every line goes through pino via `nestjs-pino`, `src/core/logging/`, with a request line per request carrying `x-request-id`, probes excluded; `docs/observability.md#logs`), `ENV_FILE` (absolute path of the env file to load instead of the root `.env`; the server exits when it is named but unreadable), `SHUTDOWN_TIMEOUT` (seconds a graceful SIGTERM stop may take before the watchdog forces exit, default 30), `DB_POOL_SIZE` / `DB_POOL_IDLE_TIMEOUT` (Postgres pool: max connections, default 10, and idle-timeout seconds, default 10; ignored on SQLite — `src/core/utils/db-pool.ts`), `INTERNAL_API_TOKEN` (a secret shared by the server and the website; the site's server-side requests to the API — the word pages, the headword walk of `apps/site/src/core/headwords.ts` — carry it as `X-Internal-Token` and `PublicApiThrottlerGuard` does not count them against `PUBLIC_API_RATE_LIMIT`; 16+ characters, unset = no exemption), `SUGGESTIONS_RATE_LIMIT` (reports per client on the public POST /api/v1/suggestions — the word pages' "Report a mistake", moderated on the admin Suggestions page; `<requests>/<seconds>`, default 5/3600), `UPDATE_CHECK` (on by default: `UpdateCheckService` in `SettingsModule` asks GitHub for the latest stable release, cached six hours, and the admin UI shows a notice — `GET /api/settings/update-check`, `components/UpdateNotice`; the same switch covers the check for newer files of the sources of the installed datasets; `false` makes no outgoing request; `docs/upgrading.md#update-notice`), `AUDIT_RETENTION_DAYS` (days the audit journal is kept — `AuditModule`, what was done on the instance: a row per import run, settings change, switch of the dataset, verdict on a report, `GET /api/en/audit` + the Events tab of the admin History page; the edits of the dictionary are not in it, see the history of edits below; default 90, 0 = forever). Probes: `GET /api/health` (liveness) and `GET /api/ready` (readiness, 503 without the database, while stopping, while the first-start import runs or after it failed) — `HealthModule`, outside both API surfaces, see `docs/deployment/README.md`. `DICTIONARY_AUTO_IMPORT` (off by default, on in `docker-compose.yml`): `DictionaryBootstrapService` loads the dictionary on a start with no recorded dataset version (from `DICTIONARY_IMPORT_DIR` or HuggingFace; `DICTIONARY_DATASET_VERSION` pins a revision tag); one import at a time (`ImportStatusService`, 409 `import_in_progress`), status at `GET /api/en/dictionary/import/status`; the import pipeline reports through `ImportProgressSink` (HTTP NDJSON stream or the log).

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

### Public API: an explicit projection, raw-row loading

`PublicApiModule` serves `/api/v1`: the search (`GET /search` and `GET /search/detailed`; the `POST` forms of the alpha were removed in the beta), the headword reads (`/words/{word}` and its `/meanings`, `/translations`, `/forms`, `/synonyms`, `/antonyms`, `/history`), `POST /words/batch` (up to 50 spellings, one rate-limit unit), `/words/id/{id}`, the filtered cursor-paged `/words` (`search` prefix, `is_obsolete`, enum filters), `/random`, `/meta` (`available_languages`, counts, license) and `/suggestions`; and the two reads that answer from every dataset of the instance, `/words/{word}/datasets` and `/words/{word}/datasets/{dataset}/history` (see the datasets below). A headword is matched without regard to case, unless the dictionary holds several spellings that differ by it (`Polish` / `polish` in a dataset of a public source): those are words of their own, a request that spells one exactly gets that one and `meta.variants` names the others (`HeadwordReader.resolveMany` in `PublicApiModule/utils/headword-reader.ts`: the headword reads of one connection, which is one dataset). Answers are the explicit projection of `types/public/v1` (`PublicWordV1T`, `PublicSearchWordV1T`, …), assigned field by field in `PublicApiModule/utils/projection.ts` — never a spread of an entity, so a new column stays internal until added on purpose; the editorial state (`generated`, `generated_by_model`, `version`, `user_modified`) is admin-only. Every full read (public, search, the admin `GET /api/en/:id`) loads its rows through `EnModule/word-rows.service.ts` (`WordRowsService`): the per-relation statements of `find()` without entity hydration, pinned to `find()` by a unit test. Every public `GET` carries ETag / Last-Modified / Cache-Control (`PublicCacheInterceptor`); one rate budget per client IP for the whole prefix (`PublicApiThrottlerGuard`, `PUBLIC_API_RATE_LIMIT`).

### Datasets: a Postgres schema each, one active

An instance holds several dictionaries and serves one (`docs/datasets.md`). Which public ones it can hold is a closed catalog in the code, `core/constants/dataset_catalog.ts` (`default`, `wiktionary`, `wordnet`, `wordnet_princeton`, `opengloss`): the name, the `source` of the public API, the license, the attribution and the files to download are stated there and nowhere typed by an admin — nothing about them is edited (`409 dataset_terms_fixed`), and `DatasetsService` brings the registry to the terms of the catalog at every start. Next to them, the datasets of the instance's own (issue #540): rows of the registry marked `own` (`isOwnDataset`; the mark is kept, never derived from the catalog, so a later catalog entry of the same name does not take the dataset over — `catalogEntryOf`, `isPublicSourceDataset(dataset)`), created empty by `POST /api/en/datasets` under a name that is not the catalog's (`isReservedDatasetName`), whose `source` is their name and whose terms — `title`, the license of the closed list `core/constants/data_licenses.ts` or a license of the owner's own with its text in `license_text`, the attribution — are the owner's, corrected by `PATCH /api/en/datasets/{name}`; a change of the license is journaled with the license before and after, and the admin UI shows a warning first. On Postgres a dataset is a schema (`ds_<name>`; the `default` dataset is the tables in `public`, never moved) with the dictionary tables and `suggestions` in it; the registry `public.datasets` says what is installed and `settings.active_dataset` names the active one. The entities and the queries name no schema: the connection carries `search_path = ds_<name>, public` (`src/db/datasets.ts`, `searchPathExtra`), and `DatasetsService.activate` re-opens the application's DataSource on another schema behind `SwitchGate` — requests wait for the switch, the switch for the requests. Rules that follow:

- **A dataset of a public source is installed from the file of its source**: `POST /api/en/datasets/{name}/install` (`EnModule/modules/EnDatasetInstall`) takes the upload; `POST /api/en/datasets/{name}/install/download` downloads the catalog’s files directly (no arbitrary URLs). Both check that the files are what the source distributes, convert inside the import slot (including server downloads) and import the result in update mode when the dataset holds data. The admin page `managing/datasets` renders the catalog as cards and the instruction of a dataset (`InstallDataset`) from the catalog entry; its sentences are message keys, its links and numbers are data. Everything done with a dataset starts on its card (`DatasetCard`, issue #540): activating it, editing its words (the switch of the header), the import and the export (`datasets/_components/ImportDictionarySection`, `ExportDictionarySection`, dialogs that name the dataset of the card), its terms and deleting it; `managing/import-dictionary` and `managing/export-dictionary` only redirect there.
- **The admin edits any dataset, served or not** (issue #540): the admin routes of the dictionary take `?dataset=<name>` (`@ApiDatasetQuery()` documents it; `isDatasetScopedRoute` in `core/constants/datasets.ts`: `/api/en/*` but the datasets, the import and the audit journal), the header of the admin UI has the switch that sets it (a cookie the API layer adds). `datasetScopeMiddleware` takes the parameter out of the query string and runs the request in a scope carrying `DatasetsService.reader(dataset)`; the services take their repositories and their connection through `scoped()` / `scopedDataSource()` (`src/core/utils/dataset-scope.ts`), never the injected ones directly — a new service or repository of the dictionary follows that pattern, and code that needs the name of the dataset it works on reads `currentDatasetName()`, not the active one. The public API stays on the active dataset; an edit of another one counts into the `Last-Modified` of the reads of every dataset (`contentChanged`).
- **A change to a dictionary table is a dataset migration** (`src/db/dataset-migrations/`, its own list and the journal `dataset_migrations` per schema; it names no schema), everything else a shared one (`src/db/migrations/`, `public`). Enum types are shared: they are created and altered in a shared migration. `prepareDatabase()` runs both lists before the application's connection exists; `test:postgres` compares a new schema with `public`.
- **Datasets are never mixed**: an import names its target (`dataset` in the request — an installed dataset or a name of the catalog, the active one by default), fills another dataset through a connection of its own (`DatasetsService.connect`) and is refused with `dataset_source_mismatch` when the manifest names another source than the target's — or, for a dataset of the owner's, another license. No `dataset_id` column, no query over two schemas.
- **One read answers from every dataset, in groups** (`PublicWordDatasetsService`, `docs/datasets.md#reading-every-dataset-at-once`): a group per installed dataset with the terms of that dataset (`PublicMetaService.termsOf`), its own `word` / `variants`, and entries whose `source` and `modified` are the ones of that dataset. A dataset that is not served is read through `DatasetsService.reader(dataset)` — a connection on its schema that is opened by the first read and kept, closed when the dataset is deleted or activated and when the server stops; `connect()` stays the way of an import. Everything that reads a dataset works on a connection it is given (`HeadwordReader.on(dataSource, source)`, `new WordRowsService(dataSource)`), never on a schema name. A reader checks `current_schema()` when it is opened, like the application's connection. An installed dataset is public through these routes, activated or not. These routes carry the `Last-Modified` of all datasets (`PublicDatasetsCacheInterceptor`, `DatasetsLastModifiedService`; a deleted dataset leaves its instant in the settings field `dataset_removed_at`). The search and the list stay on the active dataset; a word page of the site shows the groups of this read as tabs, the project's dataset first and open, Wiktionary second (`apps/site/src/core/wordDatasets.ts`): the server renders the first tab only, the browser reads the dataset of a tab that is pressed from this route (`DatasetPanels`), so `Panel`, `Entry` and what they import run on both sides — no `server-only` module and no dataset catalog in them; a report is offered on the active tab only).
- **The terms of the data are the active dataset's**: `/api/v1/meta`, `source` on every public word, the export manifest, the word pages and the admin export page read them from the registry, which carries the terms of the catalog or, for a dataset of the owner's, the ones they stated (`title` names a dataset for readers, the site names a tab by it). `DATA_LICENSE` is what the catalog states for the project's own dataset. New public fields are optional in the contract (a 1.0 server does not send them).
- **SQLite has no schemas**: the default dataset only, `DatasetsService.supported` is false, the routes that create, edit the terms of, install, activate or delete a dataset answer 409 `datasets_not_supported` and the admin UI shows the catalog and says why nothing can be installed or created; the switch of the dataset that is edited lists the one dataset. A feature that needs a second dataset is tested in `test/*.pg-spec.ts` and in the e2e specs that branch on `checkIsPostgres()` (CI runs the e2e on both drivers).
- **The version of a dataset of a public source is what its file says** (issue #530, `docs/datasets.md#versions-and-newer-files-of-a-source`): `SourceAdapterT.versionOf` reads it from the uploaded file — the gzip header of the extract of Wiktionary, the folder or the build log of a WordNet archive (`src/converters/version.ts`) — and the day of the installation is recorded for a file that does not say. Nothing is asked of the source at installation and an installation takes no version from the admin (an import of an export on the import page carries the version of its manifest). Whether a source has a newer file is asked by `DatasetUpdatesService` (`GET /api/en/datasets/updates`, the card of the dataset): what to ask is `update_check` of the catalog entry, the rules of the comparison are `core/utils/dataset_updates`, only installed datasets are asked about, once a day, in memory, and `UPDATE_CHECK=false` asks none. The import page compares versions with the published dataset for the dataset of the project only.
- **Public sources come through converters** (`src/converters/`: a `SourceAdapterT` per source emits entries, `DatasetWriter` writes the files and the manifest with the terms of the catalog), never through a second import format; a new source is an adapter and a catalog entry (`src/converters/README.md`). Fixtures are written for the tests; no text of a source is committed.

### The history of edits: a part of the data, per dataset

Every edit of the content leaves a row in `en_changes` (entity `EnChange`, one table per dataset schema, created by a dataset migration): what was edited, the action and the values before and after (`diff`), keyed by headword and part of speech — never by id. The edit services call `recordChange` (`EnModule/utils/changes/`) inside the transaction of the mutation; where an edit comes from (admin, an applied suggestion with its author, a revert) is said around the call with `withChangeSource`, not passed through signatures. An edit of the common data stamps the entry `custom_version` and records the version it had (`diff.version`, admin-only); taking back the last change of an entry that shows returns that version (`restoreVersion`). A new mutation of the content must call `recordChange`, and a new field of a record goes into its snapshot (`snapshots.ts`) and into the column list of `revertChange.ts`. The history starts empty — a dataset is clean until an edit is recorded, nothing is inferred from `user_modified`, by a migration or by an import. "Modified" is computed, not stored: an entry is modified while it has rows with an empty `superseded_at` (`WordRowsService.modifiedWords`, one statement per answer). Every public answer that carries an entry or a part of one carries `source` and `modified` — a new public read must too. `EnChanges` (controller + service) lists the history, takes a change back and removes an author's name; the public projection is `toPublicChange` behind `GET /api/v1/words/{word}/history`. The history travels in an export (`vocab-bloom-hub-en-changes.jsonl`) and is merged by an import. Content edits are **not** written to `audit_log`. Human-authored public sources take nothing marked `generated` (`generated_not_allowed`, `isHumanAuthoredDataset`); OpenGloss explicitly declares generated content and accepts it, as do the project's dataset and the owner's. Details: `docs/datasets.md#editing-a-dataset-the-history-of-edits`.

### Server: domain modules with sub-controller/service pairs

Modules live in `apps/server/src/modules/` (AppModule is the root; AuthModule, EnModule, SettingsModule, SuggestionsModule, PublicApiModule, AuditModule, DatasetsModule, HealthModule, MetricsModule). The pattern inside a domain module like `EnModule`:

- `entities/` — TypeORM entities (EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation), registered both in the module's `forFeature` and in AppModule's `forRootAsync`.
- `modules/<Feature>/` — feature folders (EnSearch, EnImportDictionary, EnMeaning, ...) each holding a controller + service (+ dto/, utils/). These are **not** separate Nest modules; their controllers/providers are registered in the parent `en.module.ts`.

A global `ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true, transform: true` — request DTOs must declare every field with class-validator decorators or requests fail.

### Auth: single admin from env

There is no user table. `AuthService` derives hashes from the `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars, issues a JWT with the admin role (signed via `core/utils/auth`, `jsonwebtoken`), and sets it as an httpOnly `bearer` cookie (`secure` in production). `AdminGuard` in `AuthModule` validates the token on protected routes, reading it from the Authorization header or the cookie. Browser requests carry the cookie via `credentials: 'include'`; during SSR the `Server*Api` wrappers forward the incoming cookie as a Bearer header.

### Frontend API layer: error unions, not exceptions

API clients in `src/core/api/` are static classes extending `AbstractBaseApi` (one class per server domain: AuthApi, EnApi, SettingsApi). Requests never throw — every method returns `T | ErrorResT`, and callers must check the `error` flag. Follow this pattern when adding endpoints. Base URL comes from `NEXT_PUBLIC_BASE_API_URL`.

Reusable presentational primitives live in `src/core/ui/`; app-level composite components in `src/components/`; route-specific components in `_components/` folders next to their route.

## Agent tooling

Everything an agent needs is vendor-neutral and lives once; there are no per-agent copies.

### Working on a task

- Start with `git status --short`; preserve unrelated changes. Read the nested `AGENTS.md` of
  an app before editing it, including when the session starts at the repository root.
- Use the pinned Yarn from `packageManager`; do not introduce npm/pnpm lockfiles. Check
  `node --version` before Jest (24.9+). Use `uv` for the Python SDK.
- Follow the nearest existing implementation and tests. For UI text, update all eight locale
  catalogs of the affected app and preserve Arabic RTL behavior.
- Run tests that exercise the changed behavior, then `yarn check`. For Python changes also run
  `uv run ruff check .`, `uv run mypy` and `uv run pytest` in `packages/python-sdk`. If a check
  cannot run, report the command and blocker; do not describe it as passing.
- Browser tests boot isolated databases; use those fixtures for verification rather than
  changing the developer's `.env` or importing into their database.
- Finish with what changed, validation results and remaining limitations. Commit, push,
  publish or deploy when the user requests it; otherwise leave the changes available for review.

### Configuration

- **Instructions**: this file (and the nested `AGENTS.md` in `apps/frontend` and `apps/site`, which
  `next dev` regenerates). The `CLAUDE.md` files hold only `@AGENTS.md`, the documented shim for
  Claude Code; Gemini CLI reads `AGENTS.md` through `context.fileName` in `.gemini/settings.json`.
- **Skills** (the [Agent Skills](https://agentskills.io) standard, `.agents/skills/<name>/SKILL.md`):
  `create-issue` (a GitHub issue from the templates) and `release-changelog` (the CHANGELOG entry of
  a release). Codex, Cursor, Gemini CLI, Copilot, Windsurf, Amp and OpenCode load that directory and
  expose them as `/<name>`. An agent that does not (Claude Code, Kiro) is asked directly — "run the
  create-issue skill" — and follows the SKILL.md as written.
- **MCP**: [Context7](https://github.com/upstash/context7) (up-to-date library docs — ask for it
  when writing code against Next.js, NestJS, TypeORM, Ant Design, httpx, …) is configured as the
  same stdio server (`npx -y @upstash/context7-mcp`) in every client's project file: `.mcp.json`
  (Claude Code), `.codex/config.toml`, `.cursor/mcp.json`, `.gemini/settings.json`, `.vscode/mcp.json`
  (VS Code / Copilot), `.kiro/settings/mcp.json`, `.amp/settings.json` and `opencode.json`. Windsurf,
  Jules, the Copilot CLI and the Copilot coding agent have no project file: add the same command in
  their global settings or UI. A key is optional — export `CONTEXT7_API_KEY` in the shell for higher
  rate limits, never put it in these files. A new MCP server goes into all of them.

Codex's project configuration in `.codex/config.toml` reserves 64 KiB for project instructions
(the root file is already close to the default 32 KiB) and allows 60 seconds for Context7's
cold start. First-run checks and the trust requirement are in
[`CONTRIBUTING.md`](./CONTRIBUTING.md#coding-agents).

## Conventions

- Commit messages follow `feat:`/`fix:`/`docs:` style; branches like `feature/...`, `fix/...` (see CONTRIBUTING.md). PRs go to `main`.
- ESLint config is split in `eslint/` (base/next/nest) and composed in root `eslint.config.ts`; husky + lint-staged run on commit.
- Some existing comments are in Russian; that's normal for this codebase.
