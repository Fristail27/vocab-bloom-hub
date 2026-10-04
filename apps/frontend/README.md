# Vocab Bloom Hub — Admin UI

The Next.js 16 App Router admin UI for Vocab Bloom Hub, built with Ant Design, Sass modules
and next-intl. It has eight interface languages, including Arabic with right-to-left layout.
It manages dictionary content, datasets, suggestions, history and instance settings.

## Run and check

From the repository root, with the shared `.env` configured:

```bash
yarn front:dev                          # port 3000 by default
yarn workspace frontend build
yarn start:front
yarn jest --selectProjects frontend     # Node 24.9+ for the workspace suites
yarn e2e                               # build and isolated browser tests
```

The API must be running (`yarn server:dev`, port 3010 by default). Admin credentials and API
URLs come from the [environment](../../docs/environment.md).

## Managing dictionaries

**Managing → Datasets** lists the project's dataset, Wiktionary, both WordNets and OpenGloss,
as well as the owner's datasets and forks. Each card offers its applicable installation,
activation, import, export, terms, fork and deletion actions. PostgreSQL is required for
multiple datasets; SQLite shows the catalog but keeps only the default dataset.

For a public source, **How to install** defaults to **Download on the server**. Manual upload
is the fallback; OpenGloss groups its six identically named shards into senses and lexicon
sections. Progress covers download, conversion and import. Both paths use the same source
terms and validation. WordNet offers CMUdict as an optional pronunciation source.

The header chooses the dataset being edited independently of the active public dataset.
**Create fork** makes an independent copy; **Add word → Prefill from another dataset** copies
one word. Own datasets and forks have editable versions. The sources-and-licenses editor
keeps source identity separate from license details, supports manual declarations, and protects
inherited snapshots. Actual edits retain field-level history and contribution licenses;
unchanged copies keep their original terms. See [datasets](../../docs/datasets.md).

## Code map

| Path                | Responsibility                                    |
| ------------------- | ------------------------------------------------- |
| `src/app/[locale]/` | Localized routes and route-specific `_components` |
| `src/core/api/`     | API wrappers returning data or `ErrorResT`        |
| `src/core/ui/`      | Reusable presentation primitives                  |
| `src/components/`   | Composite components shared by routes             |
| `messages/`         | All eight interface catalogs                      |
| `src/proxy.ts`      | Locale middleware                                 |

Types and constants are imported from `server/types` and `server/core`; do not duplicate API
contracts here. UI text changes must cover every locale. Browser tests live in
[`apps/e2e`](../e2e/README.md) and boot isolated databases.
