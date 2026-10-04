# Vocab Bloom Hub — Server

The NestJS 12 / TypeORM API of Vocab Bloom Hub. It serves the public dictionary under
`/api/v1`, the authenticated admin API, source installation and dictionary import/export.
The website and the Node.js and Python SDKs consume the public API; the admin UI uses shared
request and response types from this workspace.

## Run and check

Run these commands from the repository root, using its `.env` and pinned Yarn version:

```bash
yarn server:dev                         # watch mode, port 3010 by default
yarn workspace server build
yarn start:server
yarn jest --selectProjects server       # Node 24.9+ for Jest
yarn workspace server test:e2e          # isolated SQLite HTTP tests
yarn workspace server test:postgres     # isolated PostgreSQL URL required
```

PostgreSQL is required for production and multiple datasets; pending migrations run at startup.
Without `DATABASE_URL`, development uses SQLite and supports only the default dataset.
Swagger is served at `/api`. See [environment](../../docs/environment.md),
[database setup](../../docs/database.md), [migrations](../../docs/migrations.md) and
[authentication](../../docs/authentication.md).

## Datasets and sources

The catalog contains the project's dataset, English Wiktionary, Open English WordNet,
Princeton WordNet 3.1 and OpenGloss 2.4. On PostgreSQL each dataset has its own schema;
one is active, while the all-datasets word read returns separate groups from every installed
one. Admin requests can edit another dataset using `?dataset=<name>`.

Source installation downloads catalog URLs on the server or accepts manual uploads, then
converts and imports through the shared import slot. OpenGloss requires three senses and
three lexicon Parquet shards. Its words retain OpenGloss's CC BY 4.0 terms, with Princeton
WordNet 3.0 terms only on words marked as derived from it. Unsupported source fields and
malformed fragments are described in [datasets](../../docs/datasets.md#opengloss-24).
The same converters run [without an instance](src/converters/README.md).

Own datasets and forks have editable versions and contribution terms. Word origins preserve
source names, versions, links and licenses; actual content edits capture contribution terms
in the per-dataset history. Unchanged copies do not acquire the destination's license.
Exports preserve these snapshots with the usual JSONL filenames, a manifest, format marker,
full notices and edit history. See [forks and sources](../../docs/datasets.md#multiple-origins-and-word-licenses)
and [the export format](../../docs/offline-import.md#provenance-export-format).

## Code map

| Path                                               | Responsibility                                                |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `core/constants/dataset_catalog.ts`                | Catalog, installation files and dataset terms                 |
| `types/`, `core/`                                  | Types, constants and utilities shared with the other apps     |
| `src/modules/EnModule/`                            | Dictionary entities, reads, edits, history, import and export |
| `src/modules/DatasetsModule/`                      | Registry, connections, activation, terms and forks            |
| `src/modules/PublicApiModule/`                     | Explicit public projections, caching and rate limits          |
| `src/converters/`                                  | Wiktionary, WordNet and OpenGloss adapters and dataset writer |
| `src/db/migrations/`, `src/db/dataset-migrations/` | Shared and per-dataset migrations                             |
| `test/`                                            | HTTP suites and PostgreSQL integration checks                 |

The public contract is documented in [API surfaces](../../docs/api.md).
Changes to it require regenerating the committed OpenAPI/schema files and both SDK models;
see [AGENTS.md](../../AGENTS.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md).
