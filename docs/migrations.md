# Database migrations

TypeORM migrations manage the **Postgres** schema. The SQLite dev fallback does not use
migrations at all — it stays on `synchronize`, so entity changes reshape `dev.sqlite`
automatically.

| Mode                                           | Schema management                                 | `synchronize` |
| ---------------------------------------------- | ------------------------------------------------- | ------------- |
| Postgres (`DATABASE_URL` set)                  | Migrations, applied automatically on server start | off           |
| SQLite (no `DATABASE_URL`, or a `sqlite:` one) | Auto-DDL from entities, dev only                  | on            |

All the relevant code lives in `apps/server/src/db/`:

- `typeorm-options.ts` — the runtime TypeORM configuration used by `AppModule`;
- `data-source.ts` — a CLI-only DataSource for the `typeorm` commands (requires `DATABASE_URL`);
- `migrations/` — the **shared** migrations plus `index.ts`, the **explicit list** of them;
- `dataset-migrations/` — the historical migration list used while upgrading installations created before #691.
- `shared-dictionary/` — the table keys, copy verification and transaction scoping for the shared dictionary tables.

## Commands

All commands run in the `server` workspace and need `DATABASE_URL` (they refuse to start
without it — migrations target Postgres only):

```bash
DATABASE_URL=postgres://user:pass@host:5432/db yarn workspace server migration:show      # list applied/pending
DATABASE_URL=... yarn workspace server migration:run                                     # apply pending
DATABASE_URL=... yarn workspace server migration:revert                                  # roll back the last one
DATABASE_URL=... yarn workspace server migration:generate src/db/migrations/MyChange     # diff entities vs DB
yarn workspace server migration:create src/db/migrations/MyDataFix                       # empty migration skeleton
DATABASE_URL=... yarn workspace server db:reset                                          # DEV ONLY: wipe schema, re-run all migrations
```

> [!CAUTION]
> `db:reset` drops every table and type in the database and replays all migrations from
> scratch — a factory reset for a broken or half-migrated **development** database. Never point
> it at a database whose data you care about.

> [!TIP]
> `DATABASE_URL` may also come from the root `.env` — the CLI DataSource loads it the same way
> the server does. A variable already set in the shell wins over the `.env` value.

## Upgrading a database with dataset schemas

`ShareDictionaryTables1795600000000` moves the default dictionary in `public` and every
registered `ds_*` dictionary into shared tables. Plan a maintenance window. Its duration
depends on the size of the data, the time to build indexes, and the storage available
for comparisons. Both copies, temporary sort files, indexes and WAL need room during the upgrade.

1. Stop the API and any import or maintenance process that writes to this database.
   Take a full database backup and restore it into a separate database.
   [Backup and restore commands](./database.md#backups).
2. On that restore, run `DATABASE_URL=... yarn workspace server migration:run` with the new
   version. Measure elapsed time, free space and WAL usage. Check active selection, public
   visibility, an existing word link in each dictionary, and a saved edit or merge plan.
3. Run the same migration on the stopped instance, or start one new server to apply it.
   The migration completes pending legacy migrations, copies all fields, checks counts and
   both content and dataset-local keys, restores ID counters including deleted IDs, then
   validates foreign keys and indexes. Only then does it retire the legacy tables and journals.
   On instances that already ran `ShareContentReviews1795600000000`, the migration retains
   the shared review table and adds missing per-dataset reviews. If the same dataset, scope
   and identity have different snapshots or check times in the two stores, the transaction
   rolls back and reports the affected source table.
   Unknown objects in an old namespace or external dependencies can stop removal. Inspect the
   PostgreSQL error and preserve those objects before retrying.
4. Check `/api/ready`, the active dataset, the admin dataset selector, and the public word
   links used in the rehearsal before resuming writes.

An interrupted or failed migration rolls back its transaction. The old database is ready
for a retry after correcting the cause. To return to the old server **after commit**,
restore the pre-upgrade backup and run the matching old version. Reconcile writes made
after the upgrade separately before restoring. The new layout and its migration history
are described in [Shared dictionary tables](./database.md#shared-dictionary-tables).

## Dictionary migrations

Register structural changes once in `src/db/migrations/index.ts`. For dictionary data,
write a migration against `public.dictionary_*`, extend its scoped view as needed, and
include `dataset_id` in local uniqueness and both ends of a foreign key. The CLI generates diffs only for ordinary registry tables. Use `migration:create` to start a hand-written dictionary migration. Test two
dictionaries with colliding local IDs as well as existing SQLite data.

## Generating migrations for registry tables

1. Edit the entity (add a column, index, table, …).
2. Generate a migration against a Postgres database that has the **current** (pre-change)
   schema:

   ```bash
   DATABASE_URL=... yarn workspace server migration:generate src/db/migrations/AddRegistryField
   ```

   TypeORM diffs the entities against that database and writes
   `src/db/migrations/<timestamp>-AddFrequencyRank.ts` with `up()`/`down()`.

3. **Register the class in `src/db/migrations/index.ts`** — both the CLI and the running
   server read this explicit array (an explicit list resolves identically from ts-node and
   from the compiled `dist`, unlike path globs). A generated migration that is not listed
   there will never run.
4. Review the generated SQL, run `yarn format`, and commit the migration file together with
   the entity change in the same PR.

Once a migration has run, add later schema changes in a new migration with a new name and
timestamp. TypeORM records the migration's name, not a checksum of its SQL: editing an
applied file will not update existing databases. Test both a fresh schema and an upgrade
from the earlier schema; a passing fresh-database test alone does not cover that upgrade.
CI also runs `TEST_UPGRADE_BACKUP=true yarn workspace server test:postgres shared-dictionary.pg-spec.ts`
with `DATABASE_URL` pointing to a disposable PostgreSQL instance with database-creation
privileges. This test uses `pg_dump` and `pg_restore` to recover a populated legacy database
and upgrades the restored copy.

No local Postgres? Spin up a throwaway one, apply the already-committed migrations to bring
it to the current schema, then generate:

```bash
docker run -d --rm --name vbh-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=vbh -p 55432:5432 postgres:17-alpine
export DATABASE_URL=postgres://postgres:pg@localhost:55432/vbh
yarn workspace server migration:run
# ...edit the entity...
yarn workspace server migration:generate src/db/migrations/MyChange
docker stop vbh-pg
```

### Extensions

`AddEntryWordTrigramIndex` runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` (trigram search).
`pg_trgm` ships with every Postgres distribution and is a _trusted_ extension since Postgres 13, so the database owner can create it without superuser rights; managed
services (RDS, Cloud SQL, Supabase, Neon, …) allow it too.

> [!TIP]
> If the migration fails with a permission error, create the extension once as a superuser and
> rerun `migration:run`.

### Hand-written migrations

`migration:generate` only diffs the schema. Write the migration yourself (start from
`migration:create`) when you need:

- **data backfills** — e.g. adding a `NOT NULL` column: add it as nullable, `UPDATE` existing
  rows, then set `NOT NULL`;
- **renames** — the generator sees a rename as drop + create, which loses data; write
  `ALTER TABLE ... RENAME COLUMN ...` manually;
- any other data transformation.

Keep `down()` a real inverse of `up()` — `migration:revert` executes it.

## How migrations run on deployment

On every start on Postgres, before its own connection is opened, the server
(`prepareDatabase` in `src/db/datasets.ts`):

1. reads the `migrations` table to see what has already been applied;
2. executes every pending shared migration in order inside **one transaction** (TypeORM's
   default `migrationsTransactionMode: "all"`) and records each;
3. opens the application pool, loads the active registry row and accepts requests.

A failed migration rolls that transaction back — every migration of that start with it, so the
database stays where the previous version left it — and **the server does not start**: better a
service that is down than one running against a schema its code does not match. A start with no
pending migrations is effectively instant. The operator's side — what an upgrade does to the
database, backups, and why the rollback is the pre-upgrade backup rather than `migration:revert`
— is in [`database.md`](./database.md#the-schema-migrations) and
[`operations.md`](./operations.md#upgrading-the-code).

## Adopting a pre-existing database

Databases created by the old `synchronize` mode already have all the tables, but no
`migrations` bookkeeping. Mark the baseline as applied **without executing it**, one time:

```bash
DATABASE_URL=... yarn workspace server migration:run --fake
```

After that, `migration:show` reports the baseline as applied and only future migrations will
actually execute.

> [!IMPORTANT]
> Skipping this step would make the first `migration:run` (or server start) fail on
> `CREATE TABLE` statements for tables that already exist.

> [!WARNING]
> `--fake` records **every** pending migration as applied, `AddDatasets` included — and the
> registry of the datasets it would have created is then missing. The server says so at start
> (`The "datasets" table is missing although every shared migration is recorded as applied`).
> Take its row back and start the server, which runs the migration for real:
>
> ```sql
> DELETE FROM "migrations" WHERE "name" = 'AddDatasets1789600000000';
> ```

## Troubleshooting

- **`DATABASE_URL must be set to run migration commands`** — the CLI DataSource refuses to run
  against SQLite. Export `DATABASE_URL` or put it in the root `.env`.
- **Baseline fails with `type "..." already exists`** — the database holds orphaned enum types
  (e.g. tables were dropped manually but Postgres types survived). The baseline drops such
  orphans itself (`DROP TYPE IF EXISTS` before every `CREATE TYPE`), so update to a version
  that includes it or run `db:reset` to start from a clean schema.
- **Baseline fails with `cannot drop type ... because other objects depend on it`** — the
  database has a real schema created by the old `synchronize` but no migrations bookkeeping;
  adopt it with `migration:run --fake` (see above) instead of executing the baseline.
- **`migration:generate` produces a huge diff or wants to drop everything** — the target
  database is not at the current schema. Run `migration:run` first (or point at the right
  database), then generate.
- **A new migration never runs** — register it in `src/db/migrations/index.ts`.
- **Dictionary view returns no rows in a SQL client** — select the owner in the same
  transaction as the query. See [Shared dictionary tables](./database.md#shared-dictionary-tables).
- **Driver mismatch errors** — entity column types are locked to a driver at import time
  (`checkIsPostgres`, see [environment.md](./environment.md#database-driver-locking)). The CLI
  DataSource loads `.env` before importing the entities for exactly this reason; always run
  migrations through the workspace scripts, not by invoking `typeorm` on ad-hoc files.
