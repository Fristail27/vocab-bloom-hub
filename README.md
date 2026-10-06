<p align="center">
  <img src=".github/assets/main-readme-logo.svg" alt="Vocab Bloom Hub logo" />
</p>

<h1 align="center">Vocab Bloom Hub</h1>

<p align="center">
  A self-hosted platform for English dictionaries, with a public API, an admin UI and SDKs. The project’s own dataset includes 300 000 entries. Install ready-made datasets or create and fork your own, preserving word sources, licenses and edit history.
</p>

<p align="center">
  <a href="https://vocab-bloom-hub.com/en"><strong>vocab-bloom-hub.com</strong></a> ·
  <a href="https://vocab-bloom-hub.com/en/docs">Documentation</a> ·
  <a href="https://vocab-bloom-hub.com/en/api">API reference</a> ·
  <a href="https://vocab-bloom-hub.com/en/playground">Playground</a>
</p>

<p align="center">
  <strong>🇺🇸 EN</strong> | <a href="docs/README.ru.md">🇷🇺 RU</a> | <a href="docs/README.es.md">🇪🇸 ES</a> | <a href="docs/README.fr.md">🇫🇷 FR</a> | <a href="docs/README.pt.md">🇵🇹 PT</a> | <a href="docs/README.de.md">🇩🇪 DE</a> | <a href="docs/README.zh.md">🇨🇳 ZH</a> | <a href="docs/README.ar.md">🌐 AR</a>
</p>

<p align="center">
  <a href="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/check-pull-request.yml"><img src="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/check-pull-request.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/codeql.yml"><img src="https://github.com/Fristail27/vocab-bloom-hub/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Fristail27/vocab-bloom-hub" alt="License: MIT" /></a>
  <a href="DATA_LICENSE.md"><img src="https://img.shields.io/badge/data-CC%20BY%204.0-lightgrey" alt="Data: CC BY 4.0" /></a>
  <a href="https://www.npmjs.com/package/@vocab-bloom-hub/client"><img src="https://img.shields.io/npm/v/%40vocab-bloom-hub%2Fclient?logo=npm&label=npm" alt="npm: @vocab-bloom-hub/client" /></a>
  <a href="https://pypi.org/project/vocab-bloom-hub/"><img src="https://img.shields.io/pypi/v/vocab-bloom-hub?logo=pypi&logoColor=white" alt="PyPI: vocab-bloom-hub" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/commits/main"><img src="https://img.shields.io/github/last-commit/Fristail27/vocab-bloom-hub" alt="Last commit" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/issues"><img src="https://img.shields.io/github/issues/Fristail27/vocab-bloom-hub" alt="Open issues" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/pulls"><img src="https://img.shields.io/github/issues-pr/Fristail27/vocab-bloom-hub" alt="Open pull requests" /></a>
  <a href="https://github.com/Fristail27/vocab-bloom-hub/stargazers"><img src="https://img.shields.io/github/stars/Fristail27/vocab-bloom-hub?style=flat" alt="Stars" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node >= 22" />
  <img src="https://img.shields.io/badge/yarn-4-2C8EBB?logo=yarn&logoColor=white" alt="Yarn 4" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white" alt="NestJS 12" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/tests-Jest%20%7C%20Playwright-C21325?logo=jest&logoColor=white" alt="Jest and Playwright" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
  <a href="CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/code%20of%20conduct-Contributor%20Covenant-5E0D73.svg" alt="Contributor Covenant" /></a>
</p>

---

## 📖 What it is

A dictionary server you run yourself. It comes with the data, an API to read it, an admin
panel to edit it, and SDKs to build on it. An instance holds several dictionaries — datasets —
and serves one of them; the others are read next to it.

**The dictionary** — the project's own dataset, the one an instance starts with

- 89 000 English words and 26 000 phrases, 161 000 senses with definitions and examples
- IPA transcription, CEFR level, register and domain labels, inflected forms
- synonym and antonym links between headwords, phrasal verbs linked to their base verb
- translations into Russian, Spanish, French, German, Portuguese, Chinese and Arabic
- open data: [CC BY 4.0](DATA_LICENSE.md), published on HuggingFace, loaded into an empty
  instance on the first start; generated with language models, not human-verified

**More datasets** — installed next to it, each one complete and under the license of its source

- English Wiktionary (CC BY-SA 4.0), Open English WordNet (CC BY 4.0), Princeton WordNet
  3.1 (WordNet license) and OpenGloss 2.4 (CC BY 4.0, plus WordNet terms on marked words)
- download source files directly on the server, or upload them manually; the server converts
  and imports them. CMUdict pronunciations are optional for WordNet
- create an empty dataset or fork an installed one, with your own version and contribution
  license; prefill a new word from another dataset or declare manually transferred sources
- preserve source names, versions, links, notices and multiple licenses per word. Unchanged
  copies retain original terms; actual edits add the fork's contribution terms and history
- read datasets separately: the main API serves one, while `GET /api/v1/words/{word}/datasets`
  and word-page tabs show every installed dataset with its own terms

**The API** — `/api/v1`, read-only, no keys

- search with relevance tiers and typo tolerance; a headword with everything attached
- filtered lists with cursor paging, a random entry, a batch lookup of up to 50 words
- a headword from every dataset of the instance at once, the history of its edits, the terms
  of the served dataset in `/meta` — its license, attribution and notices
- rate-limited per client, every answer cached with an ETag, an OpenAPI document to generate from

**The SDKs** — generated from that OpenAPI document

- Node.js / TypeScript: `npm install @vocab-bloom-hub/client`
- Python: `pip install vocab-bloom-hub` (sync, async, a pandas helper)

**The admin panel** — eight interface languages

- edit words, senses, translations and links of any dataset, served or not; every change kept
  in a history with the values before and after, shown to readers and undone in a click
- moderate the corrections readers send from the word pages
- run bulk requests to a language model over a filtered slice of the dictionary
- install, activate, import, export and delete datasets from their cards; a notice when a
  source has a newer file, and when a newer release of the app is out

**The website** — the docs, the API reference with request snippets in five languages and the two SDKs, a
playground, public word pages with a tab per dataset that holds the word

**Under the hood** — PostgreSQL (SQLite for development), Docker images, migrations on start,
health probes, Prometheus metrics, JSON logs.

> [!NOTE]
> Status: `1.1`, stable: the public API under `/api/v1` follows semantic versioning — a breaking change means a new major version.

> [!IMPORTANT]
> **The license of the served dataset binds what you serve.** The project's dataset is CC BY
> 4.0. A dataset of a public source keeps the license of that source: Wiktionary is share-alike
> (what you build on it stays under CC BY-SA 4.0), the WordNets ask that their notice travels
> with every copy. Read the terms on the card of a dataset before you install it, and show the
> `attribution` of `GET /api/v1/meta` wherever you show the data — [`docs/datasets.md`](docs/datasets.md).

---

## ⚡ Getting started

Three ways in, from the quickest to the most flexible. All of them end with the admin panel,
the API and the dictionary loaded: under Docker on <http://localhost:3241> and
<http://localhost:3240>, without it on <http://localhost:3000> and <http://localhost:3010>.

### 1. Run the published images

No checkout needed — one folder, two files, Docker:

```bash
mkdir vocab-bloom-hub && cd vocab-bloom-hub
curl -fsSLO https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/.env.example -o .env
```

Open `.env` and set two passwords: `ADMIN_PASSWORD` (the admin login) and `POSTGRES_PASSWORD`
(the bundled database). Then:

```bash
docker compose up -d
```

The first start downloads the dictionary and imports it — a few minutes. `GET /api/ready`
answers `503` until it is in and `200` after; then sign in with `ADMIN_USERNAME` /
`ADMIN_PASSWORD` from `.env`.

```bash
curl -s localhost:3240/api/ready            # {"status":"ok"}
curl -s localhost:3240/api/v1/words/run     # the dictionary answers

# search: the entries matching a term, best match first
curl -s 'localhost:3240/api/v1/search?search=run&limit=5'
# the same with meanings, examples and translations
curl -s 'localhost:3240/api/v1/search/detailed?search=run&with_meanings=true'
```

> [!TIP]
> To pin a release instead of the `main` development build, set `VBH_TAG=1.2.0` in `.env`.
> To add the website (docs, API reference, playground, word pages) on <http://localhost:3242>, set
> `COMPOSE_PROFILES=db,site`.

### 2. Run from the repository

The same compose file, built from the sources — for a fork or an unpublished change:

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git
cd vocab-bloom-hub
cp .env.example .env                           # the same two passwords
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

### 3. Run without Docker

A production run on the machine itself: Node.js 22.13+, Yarn 4 (`corepack enable`) and a
Postgres you can reach ([`docs/database.md`](docs/database.md)).

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git
cd vocab-bloom-hub
yarn install
printf 'NODE_ENV=production\nDATABASE_URL=postgres://user:password@localhost:5432/vocab_bloom\nADMIN_USERNAME=admin\nADMIN_PASSWORD=change-me\nNEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api\nDICTIONARY_AUTO_IMPORT=true\n' > .env
yarn build && yarn start                       # API :3010, admin :3000; the dictionary loads itself on the first start
yarn site:build && yarn start:site             # the website :3020, optional, in another terminal
```

Behind a domain and TLS, with systemd or PM2: [`docs/deployment/`](docs/deployment/README.md).

### For development

No database needed: without `DATABASE_URL` the server uses a local SQLite file, and every app
restarts on change.

```bash
printf 'NODE_ENV=development\nADMIN_USERNAME=admin\nADMIN_PASSWORD=change-me\nNEXT_PUBLIC_BASE_API_URL=http://localhost:3010/api\n' > .env
yarn dev                                       # API :3010, admin :3000, website :3020
```

> [!IMPORTANT]
> Load the dictionary with _Managing → Datasets → Import_ in the admin panel.

Everything else for contributors: [`CONTRIBUTING.md`](CONTRIBUTING.md).

### Next

- The documentation as a website, with the API reference and a playground:
  [vocab-bloom-hub.com](https://vocab-bloom-hub.com/en/docs).
- Put it on a server: [`docs/deployment/`](docs/deployment/README.md) — TLS and a reverse
  proxy, systemd / PM2, upgrades.
- The database: [`docs/database.md`](docs/database.md) — Postgres requirements, migrations,
  backups, sizing.
- Every setting: [`docs/environment.md`](docs/environment.md).
- Metrics and logs: [`docs/observability.md`](docs/observability.md) — Prometheus and Grafana in
  one command, or your own.
- Read the data: [`docs/api.md`](docs/api.md), the [Node.js](packages/npm-sdk/README.md) and
  [Python](packages/python-sdk/README.md) SDKs.

On PostgreSQL, add another dictionary from **Managing → Datasets → How to install**:
server download is the default, manual upload the fallback. OpenGloss needs all six Parquet
files (about 1.32 GB). Sources, licenses, forks and conversion limits:
[`docs/datasets.md`](docs/datasets.md).

---

## 🤝 Contributing

Contributions are welcome. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the workflow (branch names,
commit messages, the PR checklist), the tech stack and repository layout, every script, the
index of the documentation and the roadmap; the [Code of Conduct](CODE_OF_CONDUCT.md) applies
to every interaction. Found a bug or have an idea? Open an
[issue](https://github.com/Fristail27/vocab-bloom-hub/issues/new/choose) — the templates guide
you.

---

## 📄 License

- **Code** — [MIT](LICENSE) © Aleksei Ryzhov (Fristail27)
- **Dictionary data of the project** (exports, the public API, the HuggingFace dataset) — [CC BY 4.0](DATA_LICENSE.md): free to use and adapt, including commercially, with attribution.
- **Other datasets and borrowed material** retain their source terms: Wiktionary CC BY-SA 4.0,
  Open English WordNet CC BY 4.0, Princeton WordNet its own license, OpenGloss CC BY 4.0
  with additional WordNet 3.0 terms on marked words. Your own dataset's contribution license
  does not replace inherited word licenses: [`DATA_LICENSE.md`](DATA_LICENSE.md#datasets-of-other-sources).

> [!IMPORTANT]
> The project's dataset and OpenGloss contain LLM-generated content. Wiktionary and the
> WordNets are human-authored sources. Each dataset carries its own notices and limitations;
> read [`docs/data.md`](docs/data.md) before relying on it.
