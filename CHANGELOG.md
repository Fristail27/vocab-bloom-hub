# Changelog

The released versions of Vocab Bloom Hub. One version covers the whole monorepo — the server,
the admin UI, the website and both SDKs; the published dataset keeps its own version
(`manifest.version`), bumped at the next export after a release. Entries are curated from the
generated release notes; the full commit history lives in git.

## v0.1.0-alpha.2 — unreleased

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
