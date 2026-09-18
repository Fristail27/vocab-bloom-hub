# Changelog

The released versions of Vocab Bloom Hub. One version covers the whole monorepo — the server,
the admin UI, the website and both SDKs; the published dataset keeps its own version
(`manifest.version`), bumped at the next export after a release. Entries are curated from the
generated release notes; the full commit history lives in git.

## v1.0.0 — 2026-09-18

The first stable release: the public API under `/api/v1` is covered by semantic versioning from
here on, the packages install without a prerelease channel, the dictionary speaks seven
translation languages and the interfaces eight — Arabic as the first right-to-left one.

- **Stable channels**: `npm install @vocab-bloom-hub/client` and `pip install vocab-bloom-hub`
  resolve this release (npm `latest`; no `@alpha`, no `--pre`), and the Docker images get the
  floating tags `1.0`, `1` and `latest` next to `1.0.0`. The READMEs, the SDK READMEs and
  `SECURITY.md` say so; a breaking change to `/api/v1` means a new major version.

- **Chinese (`zh`) as a translation language and an interface language** (issue #463):
  `AvailableTranslationLanguagesE` gains `zh` (Simplified characters, Mandarin), one migration
  widens both Postgres enum types, the admin offers it (flag, labels, the bulk-request preset
  "Simplified Chinese (Mandarin)"), the public filters and `available_languages` carry it, the
  spec and both SDKs are regenerated. The admin UI and the website speak Chinese: a message
  catalog per app and `docs/README.zh.md` for the getting-started page.

- **Arabic (`ar`) as a translation language and the first right-to-left interface** (issue
  #464): the same recipe for the language (Modern Standard Arabic; a neutral icon instead of one
  state's flag), plus the layout work — `dir` on `<html>` per locale and Ant Design's
  `direction`, every physical CSS property of both apps replaced by its logical counterpart,
  translation texts isolated with `dir="auto"` in the admin previews and on the word pages,
  documentation pages keeping the direction of their own language (English pages stay
  left-to-right under `/ar`), code blocks and the playground's text inputs always left-to-right,
  and the "more" arrows after link labels pointing forward in the writing direction.

- **Plural forms checked per locale**: the message parity specs of both apps assert that every
  plural message carries exactly the categories `Intl.PluralRules` reports for its locale —
  Arabic needs six. The check completed the Russian, Spanish, French and Portuguese plurals
  (`many`) and reduced the Chinese one to `other`.

- **Dataset `v0.2.0`**: the published dataset ships all seven translation languages, each
  covering every sense and every entry, and its English side was cleaned on the way — 26 entries
  (mostly prepositions) whose titles, definitions or examples carried Russian text, and a handful
  of wrong descriptions (`fingerroot`, `copesettic`, `linelike`, `myg`, the Yeniseian languages
  called Uralic). `docs/data.md` and the `.env.example` revision example follow.

- **`HEAD` carries the caching headers of its `GET`**: a `HEAD` on a public read used to bypass
  the cache interceptor — no `Cache-Control`, no `Last-Modified`, and Express's own `ETag`
  instead of the content hash — so a proxy checking freshness with `HEAD` saw a validator that
  never matched the stored `GET`. Both methods now answer with the same three headers.

- **Getting started shows the search**: the install section of every README ends with the two
  basic requests, `GET /api/v1/search` and `GET /api/v1/search/detailed`, next to the readiness
  probe; the admin UI serves the project icon instead of the framework's default favicon.

- **New default ports under docker compose**: the stack is published on `3240` (API), `3241`
  (admin UI) and `3242` (website), and the observability overlay on `3243` (Prometheus) and
  `3244` (Grafana) — away from the `3000` and `9090` so many other tools take. Inside the
  containers, and for a start without Docker, the ports stay `3010` / `3000` / `3020`.
  **Upgrading**: an `.env` made from the earlier template names `SERVER_PORT=3010` and
  `FRONT_PORT=3000` and keeps them; the website, Prometheus and Grafana move unless
  `SITE_PORT`, `PROMETHEUS_PORT` and `GRAFANA_PORT` are set (`3020`, `9090`, `3001` before) — a
  reverse proxy pointing at them needs the new upstreams or those three lines.
  `docs/deployment/docker.md` gains an _Everything together_ section: the database, the website
  and the metrics stack on one host, from downloaded files, with the ports and the volumes.

- **The project website, vocab-bloom-hub.com**: the documentation, the API reference and the
  playground have a public address. The READMEs link it under the title and in the "Next" list
  (each in its own locale), the SDK READMEs and the package manifests (`homepage`, the PyPI
  project URLs) point at their pages, both OpenAPI documents carry it as `externalDocs`, the
  admin footer's "Docs" opens it in the interface language, and the issue chooser offers it.

- **Admin header and footer**: the footer's "Docs" was a dead label, its GitHub link had neither
  icon nor link colour (both came from a library the app does not ship), and the login page
  showed an empty version — the settings endpoint is admin-only. The footer now links the
  documentation and the repository, shows the build's own version when the server's is out of
  reach, and is translated like the rest of the interface; the header logo leads home and the
  theme and language switches have accessible names.

- **Python SDK**: `__version__` normalizes the metadata version itself (`1.1.0-beta.1` →
  `1.1.0b1`); hatchling 1.32.3 stopped writing the PEP 440 spelling, which made the value and the
  `User-Agent` depend on the build backend.

- **Maintenance**: the weekly dependency group (NestJS 12.0.x, Next.js 16.3.x, React 19.2.x and
  the rest) is in; TypeScript stays on 6.x — version 7 breaks the builds — and Dependabot now
  ignores its major updates until the move is made on purpose.

## v0.2.0-beta.1 — 2026-09-17

The first beta: the public search settles on `GET` and a stable ordering, the dictionary speaks
five translation languages and the interfaces six, every full read is several times faster, and
the documentation was rewritten and checked page by page against the running instance.

- **One translation file per language in the dataset**: the export writes
  `vocab-bloom-hub-en-meaning-translations.<lang>.jsonl` and
  `vocab-bloom-hub-en-short-translations.<lang>.jsonl` for every language that has rows instead
  of one combined file each (with five languages the combined files had grown past 100 MB); the
  import reads the per-language files and still the combined ones of earlier exports; the
  _Separate files_ tab and `POST /api/en/dictionary/import/upload` have a slot per language
  (`meaning_translations_<lang>`, `short_translations_<lang>`).

- **Spanish, French, Portuguese and German interfaces** (issue #450): the admin UI and the
  website speak six languages — `InterfaceLanguageEnum` gains `es`, `fr`, `pt`, `de`, with a
  message catalog per locale in `apps/frontend/messages` and `apps/site/messages` (LLM-drafted
  from the English one), the language switch and `hreflang` alternates follow the list, and the
  parity spec checks every catalog against English (keys and ICU arguments). The website's
  documentation stays English with the Russian pages where they exist.

- **German (`de`) and Portuguese (`pt`) as translation languages** (issue #449), the way Spanish
  and French were added: `AvailableTranslationLanguagesE` gains both, one migration widens both
  Postgres enum types, the admin offers them (flags, labels), the public filters and
  `available_languages` carry them, the spec and both SDKs are regenerated, and the bulk-request
  page gets the "German" and "Portuguese" presets (the Portuguese prompts ask for the Brazilian
  usage). The data follows with later dataset revisions.

- **Bulk request walks the rows without an OFFSET**: the admin listings (`GET /api/en/words`,
  `/meanings`, `/meaning-translations`, `/short-translations`) take `after`, the id of the last
  row of the previous page, and answer `next_after`; the rows after it come in id order, one
  index range per page, so collecting every row matching a filter no longer sorts the whole
  table per page (on the full dictionary the 285th page of 200 short translations sorted 230k
  rows in a parallel plan and ran the Docker Postgres out of shared memory). The listings run
  their queries without parallel workers on Postgres (`SET LOCAL max_parallel_workers_per_gather
= 0` per request), so a numbered page and its count never depend on the container's `/dev/shm`
  either. The numbered pages of the tables are unchanged. The bundled Postgres of
  `docker-compose.yml` gets `shm_size: 256m` as well (`docs/deployment/docker.md`).

- **French (`fr`) as a translation language** (issue #445): `AvailableTranslationLanguagesE`
  gains `fr` the way it gained `es` — a migration widens both Postgres enum types, the admin
  offers it (flag, label) wherever a translation is added, the public filters and
  `available_languages` carry it, the spec and both SDKs are regenerated. The bulk-request
  page gets the "Short translation: French" and "Meaning translation: French" presets, and its
  output lines name a meaning by `meaning_sort_order` + `meaning_title` next to `meaning_id`
  (the admin listing of meaning translations reports `meaning_sort_order` too), so a run's
  jsonl loads as the meaning-translations file of the dataset. The data follows with a later
  dataset revision.

- **Node.js 22 is enough to run it** (issue #439): the required version drops from 24 to
  `>=22.13`, the oldest release every dependency accepts, so the current LTS line of most hosts
  and distributions runs the project without a version manager. The Docker images are built on
  `node:22-alpine`, and CI lints, typechecks, builds and boots the production build and runs the
  browser and Python-SDK live tests on 22. The Jest suites stay on 24 (NestJS 12 is ESM-only and
  Jest's `require(ESM)` needs Node 24.9+), so contributors running the unit tests still need 24.

- **Fixes from the post-alpha review**: the admin UI's reads of the public prefix bypass the
  browser's HTTP cache (an edited or deleted word no longer lingers in the admin search for an
  hour); search and list items carry `base_phrasal` like the headword read; the detailed
  search rejects an empty `translation_languages` (`400`) instead of reading it as "all"; the
  batch lookup rejects a blank spelling instead of dropping it silently; `POST /api/auth/logout`
  needs no valid token, and the admin UI signs out even when the request fails; the SDKs'
  detailed-search iterators stop at the server's page cap instead of failing on page 21, and a
  retry wait is capped (`maxDelayMs` / `max_delay`, 60 s) with `Retry-After` edge cases
  (`inf`, a `-0000` date) handled; the full reads run their relation statements in two
  concurrent waves; the server e2e suite on Postgres empties the database on every application
  boot, as SQLite's in-memory database does.

- **Spanish (`es`) as a translation language** (issue #410): `AvailableTranslationLanguagesE`
  gains `es`, a migration widens both Postgres enum types, the admin offers it wherever a
  translation is added (flag and label), the public filters (`?language=`,
  `translation_languages`) and `available_languages` carry it, the website labels
  translations by language when an entry mixes them, and the export manifest counts
  translation rows per language (`translations`). The data itself follows in a later dataset
  revision.

- **Website / docs**: Russian versions of the deployment, environment-variables and API pages
  (`docs/*.ru.md`, rendered under `/ru/docs`), and the release notes as a page of the site
  (`/docs/changelog`, this file) — issue #404.

- **Docs** refreshed against the shipped alpha and this cycle's changes (issue #391): NestJS 12
  in the badges and the stack table, the SDKs described as published, the public API and SDK
  feature lists (cacheable `GET` search, batch lookup, synonyms / antonyms, retry, `User-Agent`),
  the CI gates (coverage, audits, `peers:check`), the dataset figures of the `v0.1.0` revision
  (synonym and antonym links), the agents' map of the codebase (`AGENTS.md`, then
  `CLAUDE.md`) and its picture of the public API.

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
  `GET /api/v1/search` and `GET /api/v1/search/detailed` — the admin UI, the website and
  both SDKs already do.

- **Removed** the `POST /api/v1/search` and `POST /api/v1/search/detailed` forms (issue #440):
  the alpha served every search twice, as a cacheable `GET` and as a `POST` with the same fields
  in a JSON body, and both SDKs, the admin UI and the website have used the `GET` form since
  it appeared. A `POST` now answers `404` like any unknown route; the admin _Documentation_
  pages, the OpenAPI document and the SDK types no longer list the duplicates — the npm SDK's
  `SearchRequest` / `DetailedSearchRequest` are the query-string types of the `GET` reads now
  (the same fields).

- **The data says where it comes from** (issue #457): `GET /api/v1/meta` answers `notice`
  next to `license` and `attribution` — the line to pass on to readers, that the data is
  generated by language models and not human-verified; the word pages of the website show it
  next to the license note, and the _Report a mistake_ form says that an accepted correction
  becomes part of the CC BY 4.0 data. `CONTRIBUTING.md` states the terms of a contribution
  (code MIT, data CC BY 4.0, a truthful `generated_by_model`), `DATA_LICENSE.md` how the
  generating models are chosen by their terms.

- **READMEs and docs rewritten** (issue #440): the README is a dense _What it is_ (the
  dictionary, the API, the SDKs, the admin panel, the website, under the hood) and a three-step
  _Getting started_ — the published images without a checkout, the repository with Docker, the
  production build without Docker (`yarn build && yarn start`), with `yarn dev` as its own
  development block — in every interface language (`docs/README.{ru,es,fr,pt,de}.md`); the
  tech stack, the scripts, the documentation index, the roadmap and the community links live in
  `CONTRIBUTING.md`. New pages: `docs/database.md` (Postgres inside compose or separate,
  migrations, backups, size) and `docs/api-tools.md` (Swagger UI, the OpenAPI document, the
  website's reference and playground, the admin _Documentation_ pages); the deployment pages
  lost their repetitions, `docs/observability.md` opens with how the monitoring works and the
  steps for an instance outside compose. The asides are GitHub alerts (`> [!NOTE]` …
  `> [!CAUTION]`), and no page names an issue number any more. The website renders the
  README's getting-started section at `/docs/getting-started` in six languages, groups the
  sidebar into Getting started / Deployment / Database / Operations / API / SDKs / Data /
  Project, shows the callouts as titled blocks, the build version in the footer (linked to the
  changelog) and a _Getting started_ button in the hero; the status and roadmap sections left
  the landing. The SDK READMEs name the `alpha` dist-tag in the install command (`latest` does
  not follow the prereleases).

- **Agent tooling is vendor-neutral**: the instructions live in `AGENTS.md` (the `CLAUDE.md`
  files only import it), the reusable prompts are Agent Skills in `.agents/skills/`
  (`create-issue`, `release-changelog`), and the Context7 MCP server for up-to-date library
  docs is configured in every client's project file (Claude Code, Codex, Cursor, Gemini CLI,
  VS Code / Copilot, Kiro, Amp, OpenCode); nothing in the repository is specific to one agent.

- **Configuration**: an unsupported `DATABASE_URL` scheme fails the start with the one-line
  error every other variable gets, instead of an uncaught throw from an entity decorator
  (issue #440); `.env.example` lists `METRICS_PATH`.

- **Search tiers fixed** (issue #440): `type` now binds every tier, the exact one included (a
  phrase search no longer opens with the word of the same spelling); an inflected form
  resolves to its base entry in the suffix and substring tiers as it did in the prefix tier,
  so `dabchick` no longer appears four times for `abc`; and the prefix tier fills the limit it
  is given with distinct headwords in byte order — `ab` answers ten headwords instead of the
  four left after its forms collapsed. Within the other tiers the shortest headword comes
  first. The prefix tier reads the case-folded index in order with a keyset continuation and
  the phrase tier is a plain `LIKE` again, so the full dictionary answers a prefix in the same
  few milliseconds as before the rewrite.

- **Headwords compare and sort case-insensitively** (issue #440): the grammar patterns keep
  their sentence capitals (`It’s the first time …`) and used to sort before `a` in
  `GET /api/v1/words` and hide from a lower-case prefix or headword lookup; the list order,
  the prefix filter, the search tiers and `GET /api/v1/words/{word}` now fold the case
  (`LOWER(word) COLLATE "C"`, the `AddCaseFoldedWordIndexes` migration replaces the two
  byte-order indexes). The list cursor carries a fingerprint of its filters and is refused
  with `invalid_cursor` when handed back with other ones — a cursor from before this release
  is refused too; `?cursor=` with nothing after it is the first page, and an empty
  `translation_languages` names the field in its `400`.

## v0.1.0-alpha.3 — 2026-09-04

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
