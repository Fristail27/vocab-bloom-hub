# Operating an instance: backup, upgrade, dataset updates

What an operator needs to know on day two: what holds the state of an instance, what to back
up and when, what a code upgrade does to the database and how to roll it back, and how a
dictionary update differs from a code update (issue #282).

Postgres is an external service. _How_ to dump, restore or schedule backups — `pg_dump` /
`pg_restore`, cron, the snapshot feature of a managed provider — is Postgres and hosting
documentation, not covered here. This page only says _what_ to back up and _when_.

## What holds state

The **database behind `DATABASE_URL`** is the only state of an instance:

- the dictionary — imported entries and every edit made in the admin UI;
- the `settings` table, including the version of the last imported dataset
  (`en_dataset_version`, shown by `GET /api/v1/meta`);
- the `migrations` table — which schema migrations have been applied.

Both processes (server and frontend) are stateless: the only files the server writes are
temporary (under the system temp directory, while an import or export runs). A backup of the
database is a backup of the instance. Keep alongside it the things that are not data but are
needed to bring an instance back:

- the `.env` (or the process environment) — in particular `ADMIN_USERNAME` / `ADMIN_PASSWORD`,
  which are the only credentials; there is no user table;
- the folder named by `DICTIONARY_IMPORT_DIR`, if the instance imports datasets from a local
  folder ([`offline-import.md`](./offline-import.md)) — it is a source, not state, and can be
  re-created from the dataset.

Use the standard Postgres tooling (`pg_dump -Fc` of the database, or the backups of the provider
hosting it) on whatever schedule matches how often the dictionary is edited. A dictionary that is
imported once and never edited needs a backup once — after the import.

## Database backup vs dictionary export

The admin UI has _Export dictionary_ (`GET /api/en/dictionary/export`). It is not a backup:

|                    | Database backup (`pg_dump`)                           | Dictionary export (dataset)                                       |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Contains           | Everything: entries, edits, settings, ids, migrations | The dictionary content only, as NDJSON files + `manifest.json`    |
| Restores           | The instance exactly as it was                        | Nothing — importing it _merges_ into the current dictionary       |
| Ids and timestamps | Preserved                                             | Stripped; a new import assigns new ids                            |
| Made for           | Disaster recovery, rollback of an upgrade             | Sharing, versioning, moving content between instances, publishing |
| Format             | Postgres-specific, tied to the schema version         | Portable, diffable, independent of the database                   |

Take the export when you want the _content_ — to publish it, diff it against the upstream
dataset, or seed another instance ([`offline-import.md`](./offline-import.md)). Take the
database backup when you want to be able to _go back_. The data terms of an export are in
[`DATA_LICENSE.md`](../DATA_LICENSE.md).

## Upgrading the code

On start the server applies every pending migration shipped with its version, then serves
requests ([`migrations.md`](./migrations.md#how-migrations-run-on-deployment)). Deploying is
therefore just: ship the new version and restart. Two consequences follow:

1. **The database becomes bound to the new version.** Once a migration has run, the previous
   version of the code no longer matches the schema and is not expected to work against it.
2. **A failed migration stops the server** deliberately (fail-fast, inside a transaction) — the
   database is left at the last applied migration and the service is down until the problem is
   fixed or the backup is restored.

The procedure:

```bash
# 1. back up the database with your Postgres tooling (pg_dump -Fc ... / provider snapshot)
# 2. see what the new version is about to apply (optional)
DATABASE_URL=... yarn workspace server migration:show
# 3. deploy: new code, yarn install --immutable, rebuild both apps, restart the processes
#    (docs/deployment/README.md) — pending migrations run on the server's start
# 4. confirm: GET /api/ready answers 200 (migrations ran, the database answers),
#    migration:show lists nothing pending, GET /api/health returns the new version
```

**Rollback = restore the pre-upgrade backup and start the previous version.** That is the only
supported way back. `migration:revert` exists for development; migrations are not guaranteed to
be reversible (some drop or rewrite data), and a revert does not undo the edits made in the admin
UI after the upgrade — which is why the backup is taken _right before_ the restart.

Upgrades that do not ship a migration (`migration:show` lists nothing pending) do not touch the
schema; rolling those back is just starting the previous build again.

The frontend has no state of its own, but `NEXT_PUBLIC_*` values are inlined at build time — a
frontend rebuild is part of every upgrade ([`deployment/README.md`](./deployment/README.md)).

## Dataset updates vs code updates

The dictionary content and the code are versioned independently: the code has releases, the
dataset has its own version (`manifest.json`, stored after import as `en_dataset_version`,
exposed by `GET /api/v1/meta` as `dataset_version`). Upgrading the code never changes the
dictionary; loading a newer dataset never changes the code.

Loading a newer dataset is the same _Import dictionary_ action as the first load — from
HuggingFace or from a file ([`offline-import.md`](./offline-import.md)). The import **merges**:

- entries missing in the instance are added;
- entries that already exist (same word, part of speech and form) are **skipped**, whatever the
  dataset says about them.

So manual edits made in the admin UI survive a dataset update — and so do entries the newer
dataset has corrected: corrections to existing entries are **not** applied. Today there is no
way to update existing entries from a dataset while keeping local edits; the choices are:

- import the newer dataset and keep the instance's version of every existing entry (default);
- start from an empty database and import the newer dataset when the instance has no edits
  worth keeping (or after exporting them — the export is a dataset too, importable into the
  fresh instance _first_, so that its entries win).

Automatic loading of the dictionary on first start is tracked in #268.

## Sizing

The full English dictionary (~330 k words, ~300 k entries) takes about **0.5 GB** in Postgres,
tables and indexes together; a compressed `pg_dump -Fc` of it is a fraction of that. Plan for
the database, the working space Postgres needs for index builds during migrations, and the
backups you keep.

**SQLite is development-only.** The server refuses to start on SQLite with `NODE_ENV=production`;
it has no migrations (`synchronize: true` reshapes the schema on every entity change), none of
the indexes the full dictionary needs ([`performance.md`](./performance.md)), and no
`migration:*` commands. A `dev.sqlite` file is not something to back up or upgrade.
