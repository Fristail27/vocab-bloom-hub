<p align="center">
  <img src=".github/assets/main-readme-logo.svg" alt="Vocab Bloom Hub logo" />
</p>

<h1 align="center">Vocab Bloom Hub</h1>

<p align="center">
  A modular open-source platform for working with vocabulary data: dictionaries, linguistic datasets, and language processing tools.
</p>

<p align="center">
  <strong>English</strong> | <a href="docs/README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/check-pull-request.yml"><img src="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/check-pull-request.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/codeql.yml"><img src="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Fristail27/vocab-bloom-hub" alt="License: MIT" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/commits/main"><img src="https://img.shields.io/github/last-commit/Fristail27/vocab-bloom-hub" alt="Last commit" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/issues"><img src="https://img.shields.io/github/issues/Fristail27/vocab-bloom-hub" alt="Open issues" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/pulls"><img src="https://img.shields.io/github/issues-pr/Fristail27/vocab-bloom-hub" alt="Open pull requests" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/stargazers"><img src="https://img.shields.io/github/stars/Fristail27/vocab-bloom-hub?style=flat" alt="Stars" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white" alt="Node >= 24" />
  <img src="https://img.shields.io/badge/yarn-4-2C8EBB?logo=yarn&logoColor=white" alt="Yarn 4" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/tests-Jest%20%7C%20Playwright-C21325?logo=jest&logoColor=white" alt="Jest and Playwright" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/code%20of%20conduct-Contributor%20Covenant-5E0D73.svg" alt="Contributor Covenant" /></a>
</p>

---

## 📑 Table of contents

- [Overview](#-overview)
- [Project status](#-project-status)
- [Features](#-features)
- [Tech stack](#-tech-stack)
- [Repository structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Getting started](#-getting-started)
- [Scripts](#-scripts)
- [Configuration](#️-configuration)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Roadmap](#️-roadmap)
- [Contributing](#-contributing)
- [Community](#-community)
- [License](#-license)

---

## 🚀 Overview

**Vocab Bloom Hub** is a monorepo-based system for building a modern lexical and linguistic platform.

It is inspired by WordNet-like structures and aims to provide:

- 📖 Multilingual dictionary database
- 🔎 Fast lexical search
- 🔗 Word relations graph (synonyms, antonyms, hypernyms, etc.)
- 📊 Linguistic datasets and tooling
- 🧠 Future SDKs for Python and Node.js

---

## 🚧 Project status

The project is in **early development** (`0.x`). The English dictionary, the admin UI and the import/export pipeline are usable today, but the API contract may still change between releases without a deprecation period. Follow the [issues](https://github.com/Fristail27/vocab-bloom-hub/issues) and [pull requests](https://github.com/Fristail27/vocab-bloom-hub/pulls) to see what is being worked on.

---

## ✨ Features

- **Admin UI** (English / Russian interface) with three areas:
  - _Managing_ — create and edit English words, their meanings, translations, synonyms, antonyms and short translations;
  - _Statistics_ — an overview of the dictionary contents;
  - _Documentation_ — in-app reference for the data model.
- **REST API** documented with Swagger/OpenAPI: a public read-only, versioned prefix `/api/v1` for consuming applications (no login, rate-limited) and an admin API protected by a single admin login (httpOnly JWT cookie or Bearer token) — see [`docs/api.md`](docs/api.md).
- **Dictionary import / export** as NDJSON datasets (`POST /api/en/dictionary/import`, `GET /api/en/dictionary/export`), so the whole dictionary can be versioned, shared or moved between environments — including offline, from an uploaded archive or a folder on the server (see [`docs/offline-import.md`](docs/offline-import.md)).
- **Search** across words, meanings and translations.
- **PostgreSQL** in production with TypeORM migrations applied on startup, and a zero-config **SQLite** fallback for local development and tests.
- **Shared API types** — the frontend imports request/response types and error codes straight from the `server` workspace, so the two apps never drift apart.
- **Quality gates** — ESLint, Prettier, type checks, unit, API and browser e2e tests run in CI on every pull request; CodeQL scans `main`.

---

## 🧰 Tech stack

| Layer    | Technology                                                                                 |
| -------- | ------------------------------------------------------------------------------------------ |
| Frontend | [Next.js 16](https://nextjs.org/) (App Router), React, Ant Design, Sass modules, next-intl |
| Backend  | [NestJS 11](https://nestjs.com/), TypeORM, Swagger (OpenAPI)                               |
| Database | PostgreSQL (production) / SQLite via better-sqlite3 (development)                          |
| Testing  | Jest, Supertest, Playwright                                                                |
| Tooling  | TypeScript, Yarn 4 workspaces, ESLint 10, Prettier, Husky + lint-staged, Dependabot        |

---

## 🧱 Repository structure

```txt
.
├── apps/
│   ├── frontend/   → Next.js admin UI (en/ru locales)
│   ├── server/     → NestJS API; also exports shared types (types/) and constants (core/) used by the frontend
│   └── e2e/        → Playwright browser tests that boot both apps against an isolated SQLite database
├── docs/           → In-depth documentation (environment, authentication, migrations) and the Russian README
├── eslint/         → Shared ESLint config pieces (base / next / nest)
├── .github/        → CI workflows, issue/PR templates, Dependabot, CODEOWNERS
├── .env            → Single environment file used by both apps (not committed)
└── package.json    → Root workspace scripts
```

---

## ✅ Prerequisites

- **Node.js >= 24**
- **Yarn 4** (the repo pins the version via `packageManager`; enable it with `corepack enable`)
- **PostgreSQL** — optional. Without `DATABASE_URL` the server falls back to a local `dev.sqlite` file.

---

## ⚡ Getting started

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git
cd vocab-bloom-hub
yarn install
```

Create a `.env` file at the repository root. The minimal development setup is:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
NODE_ENV=development
NEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api
```

Then start both apps:

```bash
yarn dev
```

- Admin UI: <http://localhost:3000> (the login page is at `/en/login` or `/ru/login`)
- API: <http://localhost:3010>
- Swagger UI: <http://localhost:3010/api> (disabled in production)

Sign in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` values from your `.env`. See [`docs/environment.md`](docs/environment.md) for the full list of variables, including the Postgres setup.

> **Tip:** the SQLite fallback keeps its schema in sync with the entities automatically, so you can start hacking on the data model without writing migrations. Switch to Postgres (and migrations) once the change is ready — see [`docs/migrations.md`](docs/migrations.md).

---

## 📜 Scripts

All commands run from the repository root.

| Command                              | What it does                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `yarn dev`                           | Run the API and the admin UI together (with watch)                                                   |
| `yarn server:dev` / `yarn front:dev` | Run only the API (port `SERVER_PORT`, default 3010) or only the UI (port `FRONT_PORT`, default 3000) |
| `yarn test`                          | All unit tests (server + frontend)                                                                   |
| `yarn jest --selectProjects server`  | Only server tests (or `frontend`)                                                                    |
| `yarn workspace server test:e2e`     | Server e2e tests (Supertest against an in-memory SQLite)                                             |
| `yarn e2e` / `yarn e2e:ui`           | Browser e2e: production frontend build + Playwright (API :3011, UI :3001)                            |
| `yarn lint` / `yarn lint:fix`        | ESLint                                                                                               |
| `yarn format` / `yarn format:check`  | Prettier                                                                                             |
| `yarn check`                         | `lint` + `format:check` — run before opening a PR                                                    |

Database migrations (Postgres only, need `DATABASE_URL`):

```bash
DATABASE_URL=postgres://... yarn workspace server migration:generate src/db/migrations/MyChange
DATABASE_URL=postgres://... yarn workspace server migration:run      # also migration:revert / migration:show
```

---

## ⚙️ Configuration

A single `.env` at the repository root is shared by both apps. The most important variables:

| Variable                   | Required      | Description                                                                    |
| -------------------------- | ------------- | ------------------------------------------------------------------------------ |
| `ADMIN_USERNAME`           | yes           | Admin login                                                                    |
| `ADMIN_PASSWORD`           | yes           | Admin password; the server refuses to start when it is missing                 |
| `DATABASE_URL`             | in production | `postgres://user:pass@host:5432/db` or `sqlite:<path>`; SQLite fallback in dev |
| `SERVER_PORT`              | no (3010)     | API port                                                                       |
| `FRONT_PORT`               | no (3000)     | Admin UI port                                                                  |
| `NEXT_PUBLIC_BASE_API_URL` | no (`/api`)   | API base URL used by the browser; inlined at build time                        |
| `CORS_ORIGINS`             | no            | Comma-separated allowed origins                                                |
| `LOG_LEVEL`                | no            | `verbose` / `debug` / `log` / `warn` / `error` / `fatal`                       |
| `NODE_ENV`                 | no            | `production` requires Postgres, secures the auth cookie and disables Swagger   |

Full reference with defaults and startup validation rules: [`docs/environment.md`](docs/environment.md).

---

## 🚢 Deployment

There is no Docker image or hosted build yet; both apps are deployed as plain Node.js processes.

1. Provide the environment (as a root `.env` or process variables): `NODE_ENV=production`, a `postgres://` `DATABASE_URL`, strong `ADMIN_USERNAME` / `ADMIN_PASSWORD`, `CORS_ORIGINS` with the admin UI origin, and `NEXT_PUBLIC_BASE_API_URL` pointing at the public API URL.
2. Build: `yarn workspace server build` and `yarn workspace frontend build` (`NEXT_PUBLIC_*` values are baked in at this step).
3. Start: `yarn workspace server start` and `yarn workspace frontend start`. Pending migrations run automatically on server startup; the server refuses to boot on SQLite or without credentials in production.
4. Serve the UI over HTTPS — the auth cookie is `secure` in production and will not be sent over plain HTTP.

Details, including how to adopt migrations on a database created by the old auto-sync mode: [`docs/migrations.md`](docs/migrations.md).

---

## 📚 Documentation

- [`docs/environment.md`](docs/environment.md) — every environment variable, driver selection, startup checks
- [`docs/authentication.md`](docs/authentication.md) — how the single-admin login, login proof and JWT cookie work
- [`docs/migrations.md`](docs/migrations.md) — TypeORM migrations workflow for Postgres, deployment and troubleshooting
- [`docs/offline-import.md`](docs/offline-import.md) — moving a dictionary between instances without internet access (export → copy → import from file)
- [`docs/api.md`](docs/api.md) — the public `/api/v1` contract (envelope, errors, rate limit, deprecated aliases) and the public-only / admin-only switches
- [`docs/README.ru.md`](docs/README.ru.md) — this README in Russian
- Swagger UI at `/api` on a running server — the live API reference

---

## 🗺️ Roadmap

Planned directions, in no particular order (see the [issues](https://github.com/Fristail27/vocab-bloom-hub/issues) for the current state):

- Semantic search and a semantic network on top of the dictionary (next major version)
- Word relations graph beyond synonyms and antonyms: hypernyms/hyponyms, collocations
- More source languages besides English, and translations into languages other than Russian
- Public read-only API and SDKs for Node.js (`npm-sdk`) and Python (`python-sdk`)
- Published linguistic datasets built from the dictionary
- Docker images and a one-command deployment

---

## 🤝 Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow (branch naming, commit messages, PR checklist) and the [Code of Conduct](CODE_OF_CONDUCT.md).

Found a bug or have an idea? Open an [issue](https://github.com/Fristail27/vocab-bloom-hub/issues/new/choose) — the templates will guide you. Every pull request is checked by CI (lint, format, type checks, tests), so run `yarn check && yarn test` locally first.

---

## 💬 Community

- [GitHub Discussions](https://github.com/Fristail27/vocab-bloom-hub/discussions) — questions, ideas, show & tell
- [Issues](https://github.com/Fristail27/vocab-bloom-hub/issues) — bug reports and feature requests

---

## 📄 License

[MIT](LICENSE) © Alexey Ryzhov (Fristail27)
