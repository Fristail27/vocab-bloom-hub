# Changelog

The released versions of Vocab Bloom Hub. One version covers the whole monorepo — the server,
the admin UI, the website and both SDKs; the published dataset keeps its own version
(`manifest.version`), bumped at the next export after a release. Entries are curated from the
generated release notes; the full commit history lives in git.

## v0.2.0-beta.1 — unreleased

- **Website / docs**: Russian versions of the deployment, environment-variables and API pages
  (`docs/*.ru.md`, rendered under `/ru/docs`), and the release notes as a page of the site
  (`/docs/changelog`, this file) — issue #404.

- **Docs** refreshed against the shipped alpha and this cycle's changes (issue #391): NestJS 12
  in the badges and the stack table, the SDKs described as published, the public API and SDK
  feature lists (cacheable `GET` search, batch lookup, synonyms / antonyms, retry, `User-Agent`),
  the CI gates (coverage, audits, `peers:check`), the dataset figures of the `v0.1.0` revision
  (synonym and antonym links), CLAUDE.md's picture of the public API.

- **Server**: the full word reads — headword, id, batch, random, the detailed search and the
  list with joins, the admin entry read — assemble their rows from the same per-relation
  statements without TypeORM entity hydration (issue #424): a batch of 50 headwords answers
  in ~22 ms instead of ~275 ms on the full dictionary, one headword in ~7 ms instead of ~9,
  with 9 statements instead of 23. The answers are unchanged (a test pins the loader to
  `find()` field for field).

- **npm SDK**: a CommonJS consumer (`require`, or TypeScript with `"module": "CommonJS"`)
  now resolves the CommonJS declarations (`dist/index.d.cts`) instead of the ESM ones — the
  `exports` map carries `types` per condition (issue #402). `publint` and
  `@arethetypeswrong/cli` gate the packed tarball in CI and before every publish.

- **SDK ergonomics** (issue #408), both clients: an opt-in `retry` of the `GET` reads on
  `429` / `5xx` honouring `Retry-After` (off by default, so request counts stay explicit), a
  versioned `User-Agent` (`vocab-bloom-hub-npm/<version>`, `vocab-bloom-hub-python/<version>`,
  overridable through `headers`), a page iterator over the detailed search
  (`iterateSearchDetailed` / `iter_search_detailed`); the Python client takes `options=`
  (`headers`, `timeout`) on every method like the Node client's last argument, and the async
  client gained `words_dataframe`.

- **Python SDK**: `vocab_bloom_hub.__version__` reports the installed version (it was a
  hardcoded `0.0.1`), read from the package metadata so it follows `pyproject.toml` on every
  release; `typing-extensions`, imported by the client, is a declared dependency instead of a
  transitive accident (issue #401).

- **Breaking (prerelease window): the public `/api/v1` word items are an explicit projection**
  (issue #392) instead of the database entity. The fields are enumerated in
  `types/public/v1` and mapped by name; the editorial state of the instance —
  `generated`, `generated_by_model`, `version`, `user_modified` — and the never-populated
  `base_form` are gone from the public answers (the admin API keeps them). Nullable columns
  answer `null` rather than being absent. In the OpenAPI document and both SDKs the word
  schemas are `PublicWordV1T` / `PublicSearchWordV1T` (previously `EnWordT` / `EnSearchWordT`);
  the SDKs' `Word` and `SearchWord` aliases follow.

- **Removed** the deprecated `POST /api/en/search` and `POST /api/en/search/detailed` aliases
  (issue #395). They answered with the pre-envelope bodies and a `Deprecation: true` header
  through the alpha; the beta is the removal window the notice promised. Use
  `POST /api/v1/search` and `POST /api/v1/search/detailed` — the admin UI, the website and
  both SDKs already do.

## v0.1.0-alpha.3 — unreleased

The documentation catches up with the shipped alpha.

- **READMEs** (both languages): the first alpha is out — real install commands
  (`npm install @vocab-bloom-hub/client`, `pip install --pre vocab-bloom-hub`), npm and
  PyPI version badges, pinning a release via `VBH_TAG` in the deployment section.
- **`.env.example` / `docs/deployment/docker.md`**: `VBH_TAG` examples recommend pinning
  the release; `latest` is marked as arriving with the first stable release.
- **`SECURITY.md`**: the supported-versions table names the latest release instead of
  "no releases yet".

## v0.1.0-alpha.2 — 2026-09-04

The first release straight through the automated pipeline; fixes what the live run of
v0.1.0-alpha.1 surfaced.

- **Release pipeline**: npm prereleases publish under their channel dist-tag (`alpha`,
  `beta`, …) — npm refuses a bare `npm publish` of a prerelease, so the automated job
  failed on the first live run.
- **SDK READMEs**: the real install commands (`npm install @vocab-bloom-hub/client`,
  `pip install --pre vocab-bloom-hub`) now that both packages are on their registries.

## v0.1.0-alpha.1 — 2026-09-04

The first tagged release: a self-hosted dictionary instance a stranger can install from the
README, load with the published dataset and query through the public API and the admin UI.

- **Install**: `docker compose up` with published images (server, admin UI, website) and a
  bundled Postgres; the dictionary loads itself on first start.
- **Public API** `/api/v1`: words, search, filtered lists with cursor pagination, a random
  entry, dictionary metadata, reader suggestions — rate-limited, ETag-cached, described by a
  committed OpenAPI document.
- **SDKs**: `@vocab-bloom-hub/client` (Node.js / browser) and `vocab-bloom-hub` (Python,
  sync + async) — typed, generated from the same OpenAPI document, contract-tested in CI.
- **Admin UI**: word management, dictionary import/export (with in-place updates that keep
  the admin's edits), moderation of reader reports and edit proposals, statistics, an audit
  journal, settings.
- **Website**: the documentation rendered from the repository, an API reference and live
  playground from the OpenAPI document, server-rendered word pages.
- **Operations**: Postgres migrations on start, health/readiness probes, graceful shutdown,
  structured logs, Prometheus metrics with a provisioned Grafana dashboard, deployment guides
  (Docker, systemd/PM2, reverse proxy).
- **Dataset**: published on HuggingFace under CC BY 4.0, importable by pinned revision.
