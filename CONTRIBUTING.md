# Contributing to Vocab Bloom Hub

First of all, thank you for considering contributing to Vocab Bloom Hub ❤️

We welcome all kinds of contributions, including:

- Bug fixes
- New features
- Documentation improvements
- UI/UX enhancements
- Performance optimizations
- Refactoring
- Tests and tooling

## Getting Started

### Prerequisites

- **Node.js >= 22.13** to run it; the Jest suites need 24.9+ (NestJS 12 is ESM-only and Jest's
  `require(ESM)` needs it)
- **Yarn 4** (the repo pins the version via `packageManager`; enable it with `corepack enable`)
- **PostgreSQL** — optional for development: without `DATABASE_URL` the server uses a local
  `dev.sqlite` whose schema follows the entities automatically, so a change to the data model
  needs no migration until it is ready for Postgres ([`docs/migrations.md`](./docs/migrations.md)).
  A production run and the Postgres-only suites need a real one ([`docs/database.md`](./docs/database.md))

### 1. Fork the Repository

Create your own fork of the repository on GitHub.

### 2. Clone Your Fork

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git
cd vocab-bloom-hub
```

### 3. Install Dependencies

```bash
yarn
```

### 4. Start Development Server

```bash
printf 'NODE_ENV=development\nADMIN_USERNAME=admin\nADMIN_PASSWORD=change-me\nNEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api\n' > .env
yarn dev
```

- Admin UI: <http://localhost:3000> (the login page is at `/en/login` or `/ru/login`)
- API: <http://localhost:3010>, Swagger UI at <http://localhost:3010/api>
  ([`docs/api-tools.md`](./docs/api-tools.md))
- Website: <http://localhost:3020>

The dictionary is empty until _Import dictionary_ in the admin UI loads it. The production run
of the same checkout (`yarn build && yarn start`, Postgres) is step 3 of the
[README](./README.md#3-run-without-docker).

## Tech Stack

| Layer    | Technology                                                                                 |
| -------- | ------------------------------------------------------------------------------------------ |
| Frontend | [Next.js 16](https://nextjs.org/) (App Router), React, Ant Design, Sass modules, next-intl |
| Backend  | [NestJS 12](https://nestjs.com/), TypeORM, Swagger (OpenAPI)                               |
| Database | PostgreSQL (production) / SQLite via better-sqlite3 (development)                          |
| Testing  | Jest, Supertest, Playwright                                                                |
| Tooling  | TypeScript, Yarn 4 workspaces, ESLint 10, Prettier, Husky + lint-staged, Dependabot        |

## Scripts

All commands run from the repository root.

| Command                                                 | What it does                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `yarn dev`                                              | Run the API, the admin UI and the website together (with watch)                                       |
| `yarn server:dev` / `yarn front:dev`                    | Run only the API (port `SERVER_PORT`, default 3010) or only the UI (port `FRONT_PORT`, default 3000)  |
| `yarn site:dev` / `yarn site:build` / `yarn start:site` | The website: dev server / production build / start of that build (port `SITE_PORT`, default 3020)     |
| `yarn build` / `yarn start`                             | Production build of the server and the admin UI / start both builds (`NODE_ENV=production`, Postgres) |
| `yarn test`                                             | All unit tests (server, frontend, site, npm SDK)                                                      |
| `yarn jest --selectProjects server`                     | Only server tests (or `frontend`, `site`, `sdk`)                                                      |
| `yarn workspace server test:cov`                        | Server unit tests with coverage; CI fails below the thresholds in `apps/server/jest.config.ts`        |
| `yarn workspace server test:e2e`                        | Server e2e tests (Supertest against an in-memory SQLite)                                              |
| `yarn workspace server test:postgres`                   | The Postgres-only suites: query-plan guard and trigram search (need a `postgres://` `DATABASE_URL`)   |
| `yarn e2e` / `yarn e2e:ui`                              | Browser e2e: production frontend build + Playwright (API :3011, UI :3001)                             |
| `yarn e2e:site`                                         | Browser e2e of the website (API :3012, site :3021)                                                    |
| `yarn lint` / `yarn lint:fix`                           | ESLint                                                                                                |
| `yarn format` / `yarn format:check`                     | Prettier                                                                                              |
| `yarn check`                                            | `lint` + `format:check` + `peers:check` (unmet peer dependencies) — run before opening a PR           |

Database migrations (Postgres only, need `DATABASE_URL`):

```bash
DATABASE_URL=postgres://... yarn workspace server migration:generate src/db/migrations/MyChange
DATABASE_URL=postgres://... yarn workspace server migration:run      # also migration:revert / migration:show
```

The public API contract and the two SDKs have generators of their own (`openapi:generate`,
`generate`, `generate_models.py`); the chain and when to run it are in
[`docs/api-tools.md`](./docs/api-tools.md#the-openapi-document-the-public-contract-as-a-file).

## Project Philosophy

Vocab Bloom Hub aims to be:

- Simple and maintainable
- Beginner-friendly
- Open for collaboration
- Focused on learning and productivity

Please try to keep contributions aligned with these goals.

## Branch Naming

Use descriptive branch names whenever possible.

Examples:

- `feature/add-authentication`
- `fix/mobile-layout`
- `docs/update-readme`

## Commit Messages

Please write clear and meaningful commit messages.

Examples:

- `feat: add spaced repetition algorithm`
- `fix: resolve vocabulary sorting issue`
- `docs: improve installation guide`

## Pull Requests

Before submitting a pull request:

- Ensure the project builds successfully and `yarn check` passes
- Keep PRs focused and minimal
- Avoid unrelated changes in the same PR
- Update documentation if needed

### Licensing of contributions

There is no contributor agreement to sign. By opening a pull request you agree that your
contribution is licensed under the terms of what it changes: code and documentation under the
[MIT license](./LICENSE), dictionary data — an entry edited in the admin UI, a correction sent
through _Report a mistake_ on a word page and applied by the owner, a dataset revision — under
[CC BY 4.0](./DATA_LICENSE.md). Keep the model label (`generated_by_model`) truthful on data
you generate: every record names the model behind it, see [`docs/data.md`](./docs/data.md).

### Documentation languages

English is the source language of the documentation. A page may have translated versions next
to it, named `<name>.<lang>.md` (`docs/api.md` ↔ `docs/api.ru.md`; the README's live under
`docs/`: `README.md` ↔ `docs/README.ru.md`, `README.es.md`, `README.fr.md`, `README.pt.md`,
`README.de.md`, `README.zh.md`) and registered under `translations` in
`apps/site/src/content/registry.ts`, where the website renders them under `/ru`, `/es`, `/fr`,
`/pt`, `/de`, `/zh`. The README exists in
every interface language of the apps; the other pages have a Russian version at most. A page
without a translation shows the English text on the site with a notice. Code comments, issue
and PR templates and the pages without a translation are English only.

> [!IMPORTANT]
> Any change to a page with translations must be applied to every one of them in the same PR so
> they stay in sync section by section.

### Pull Request Checklist

- [ ] Code builds successfully
- [ ] Changes were tested
- [ ] Documentation updated if necessary
- [ ] No unnecessary files included

The `check-pull-request` workflow runs the linters, the typecheck of every workspace, the
unit and e2e suites (SQLite and Postgres), the browser suites, the production and Docker
smokes, and two quality gates: the server unit coverage must not drop below the thresholds
in `apps/server/jest.config.ts` (`yarn workspace server test:cov` reproduces the check), and
`yarn npm audit --all --recursive --severity high` plus `pip-audit` on the Python SDK must
find nothing — fix an advisory by upgrading (`yarn up -R <package>`), not by silencing it.

## Coding Guidelines

Please follow the existing project structure and coding style.

General recommendations:

- Write readable and maintainable code
- Use meaningful variable and function names
- Prefer reusable components
- Avoid unnecessary dependencies
- Keep functions and components small when possible

### Dependencies

- Declare a dependency in the workspace that imports it (`apps/frontend`, `apps/server`, …),
  not at the root; the root holds only the tooling shared by every workspace.
- Peer dependencies must be met. `yarn peers:check` (part of `yarn check`, run in CI) fails
  on any unmet one — Yarn itself only warns. When a package declares a range that lags
  behind the version the monorepo runs and CI exercises the combination anyway, list it in
  `KNOWN_MISMATCHES` in `scripts/check-peer-requirements.mjs` with the reason; the check
  also fails when a listed mismatch is gone, so the list stays current. Yarn's
  `packageExtensions` cannot widen a range a package already declares, which is why the
  exceptions live there.
- Dependabot (`.github/dependabot.yml`) watches every workspace manifest, the Python SDK (uv)
  and the GitHub Actions, grouped per directory into one weekly PR each. A new workspace
  must be added to its `directories` list.

## Reporting Bugs

When creating a bug report, please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Environment information

## Suggesting Features

Feature requests are welcome.

Please describe:

- The problem you are trying to solve
- Your proposed solution
- Possible alternatives

## Code of Conduct

By participating in this project, you agree to follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Releasing

One version covers the whole monorepo; the dataset keeps its own (`manifest.version`). The
repeatable part of a release:

1. **The release PR.** Bump the version everywhere with the only tool allowed to touch it —
   `node scripts/bump-version.mjs <version>` (six files; a CI test keeps them equal) — and
   curate the new `CHANGELOG.md` entry (the `release-changelog` agent skill in
   `.agents/skills/` — `/release-changelog <version>` in Codex, Cursor or Copilot, "run the
   release-changelog skill" in Claude Code — assembles the draft from everything merged since
   the previous tag); the section is dated with the day the tag will be pushed. The same PR
   moves `VBH_TAG` to the new version in `.env.example`, `docs/deployment/docker.md` and the
   install sections of the READMEs — the images exist minutes after the merge, once the tag
   is pushed.
   Merge on green CI.
2. **The tag — the whole release.** On the merged `main`:
   `git tag -a v<version> -m "..." && git push origin v<version>`.
   The one push does everything: publishes the three Docker images with that version
   (`docker.yml`; a prerelease tag never gets `latest`) and runs
   `.github/workflows/release.yml`, which verifies the tag matches the version, publishes
   `@vocab-bloom-hub/client` to npm and `vocab-bloom-hub` to PyPI via OIDC trusted
   publishing — no tokens — and creates the GitHub Release with generated notes
   (categories in `.github/release.yml`; a hyphen in the tag marks it a prerelease).
   A prerelease publishes to npm under its channel dist-tag (`alpha`, `beta`, …), never
   `latest` — npm refuses a bare `npm publish` of a prerelease version.
   A publish job that failed on the tag push is repeated from the Actions tab: _release_ →
   _Run workflow_ with the tag (the npm and PyPI checkboxes pick the jobs); a plain re-run
   would use the workflow file as it was at that tag.
   The **first npm publish is manual** (`npm publish --tag <channel>` from `packages/npm-sdk`; npm attaches a
   trusted publisher only to an existing package — configure it right after, workflow
   `release.yml`, environment `npm`, then re-run the failed npm job). PyPI's pending
   publisher covers the first publish.
3. **After the tag**: export the dictionary (the manifest carries the next dataset version),
   upload the revision to HuggingFace and git-tag it there with that version.

> [!NOTE]
> PyPI normalizes pre-release suffixes per PEP 440 (`0.1.0-alpha.1` is served as `0.1.0a1`) —
> cosmetic only, the sources keep the semver spelling. Re-run `uv lock` in `packages/python-sdk`
> after a bump so `uv.lock` follows.

> [!CAUTION]
> The tag push is the point of no return: the npm/PyPI publishes cannot be undone — a bad release
> ships a fixed next version instead. Everything before the push is free to redo.

## Documentation

Everything the repository documents, also rendered on the website:

- [`docs/deployment/`](./docs/deployment/README.md) — production build and start, probes, graceful stop, systemd / PM2; [`docker.md`](./docs/deployment/docker.md): the three images and `docker compose` with Postgres; [`reverse-proxy.md`](./docs/deployment/reverse-proxy.md): TLS, Caddy / nginx configs, exposure profiles, keeping the admin API private
- [`docs/operations.md`](./docs/operations.md) — operating an instance: what holds state and what to back up, database backup vs dictionary export, upgrading and rolling back, dataset updates vs code updates, sizing
- [`docs/database.md`](./docs/database.md) — Postgres inside compose or separate, connecting, the migrations, backups and restore, size
- [`docs/environment.md`](./docs/environment.md) — every environment variable, driver selection, startup checks
- [`docs/authentication.md`](./docs/authentication.md) — how the single-admin login, login proof and JWT cookie work
- [`docs/migrations.md`](./docs/migrations.md) — TypeORM migrations workflow for Postgres, deployment and troubleshooting
- [`docs/offline-import.md`](./docs/offline-import.md) — moving a dictionary between instances without internet access (export → copy → import from file)
- [`docs/observability.md`](./docs/observability.md) — how the monitoring works, Prometheus + Grafana in one command or your own, every metric, the JSON logs and the request id, shipping the logs to a collector
- [`docs/performance.md`](./docs/performance.md) — latency of the hot reads on the full dictionary (Postgres vs SQLite), the indexes behind them, the benchmark and the query-plan guard
- [`docs/api.md`](./docs/api.md) — the public `/api/v1` contract (envelope, errors, rate limit, caching, OpenAPI export) and the public-only / admin-only switches
- [`docs/api-tools.md`](./docs/api-tools.md) — Swagger UI, the OpenAPI document, the website's reference and playground, the admin Documentation pages: which to open when
- [`docs/data.md`](./docs/data.md) — where the dictionary data comes from (LLM-generated, `generated_by_model`), known limitations, how to report errors; the terms are in [`DATA_LICENSE.md`](./DATA_LICENSE.md)
- [`packages/npm-sdk/README.md`](./packages/npm-sdk/README.md) and [`packages/python-sdk/README.md`](./packages/python-sdk/README.md) — the SDKs
- [`docs/README.ru.md`](./docs/README.ru.md), [`README.es.md`](./docs/README.es.md), [`README.fr.md`](./docs/README.fr.md), [`README.pt.md`](./docs/README.pt.md), [`README.de.md`](./docs/README.de.md), [`README.zh.md`](./docs/README.zh.md) — the README in the other interface languages; `docs/api.ru.md`, `docs/environment.ru.md` and `docs/deployment/README.ru.md` are the other translated pages
- [`AGENTS.md`](./AGENTS.md) — the map of the codebase for coding agents (commands, architecture, conventions), kept in sync with the tree

## Roadmap

Planned directions, in no particular order (the [issues](https://github.com/Fristail27/vocab-bloom-hub/issues) show the current state):

- Semantic search and a semantic network on top of the dictionary (next major version)
- Word relations graph beyond synonyms and antonyms: hypernyms / hyponyms, collocations
- More source languages besides English, and more translation languages beyond Russian, Spanish, French, German, Portuguese and Chinese
- Published linguistic datasets built from the dictionary

## Questions

- [GitHub Discussions](https://github.com/Fristail27/vocab-bloom-hub/discussions) — questions, ideas, show & tell
- [Issues](https://github.com/Fristail27/vocab-bloom-hub/issues) — bug reports and feature requests, through the templates

## Project Structure

```text
.
├── apps/
│   ├── frontend/   → Next.js admin UI (seven interface languages)
│   ├── site/       → Next.js project website: docs, API reference, playground, word pages
│   ├── server/     → NestJS API; also exports the shared types (types/) and constants (core/) the frontend and the site import
│   └── e2e/        → Playwright browser tests that boot the apps against an isolated SQLite database
├── packages/
│   ├── npm-sdk/    → @vocab-bloom-hub/client, the Node.js / TypeScript SDK of the public API
│   └── python-sdk/ → vocab-bloom-hub, the Python SDK (uv, httpx, pydantic)
├── docs/           → the documentation (deployment, database, operations, observability, performance, environment, API, authentication, migrations, offline import, data) and the README in the other six languages
├── eslint/         → shared ESLint config pieces (base / next / nest)
├── .agents/        → skills for coding agents; the per-agent MCP configs sit next to them (AGENTS.md)
├── .github/        → CI workflows, issue / PR templates, Dependabot, CODEOWNERS
├── .env            → the single environment file of every app (not committed; .env.example is the template)
└── package.json    → root workspace scripts
```

Thank you for contributing to Vocab Bloom Hub 🚀
