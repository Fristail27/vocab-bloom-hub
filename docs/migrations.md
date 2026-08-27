# Database migrations

TypeORM migrations manage the **Postgres** schema. The SQLite dev fallback does not use
migrations at all — it stays on `synchronize`, so entity changes reshape `dev.sqlite`
automatically.

| Mode                                | Schema management                                 | `synchronize` |
| ----------------------------------- | ------------------------------------------------- | ------------- |
| Postgres (`DATABASE_URL` set)       | Migrations, applied automatically on server start | off           |
| SQLite fallback (no `DATABASE_URL`) | Auto-DDL from entities, dev only                  | on            |

All the relevant code lives in `apps/server/src/db/`:

- `typeorm-options.ts` — the runtime TypeORM configuration used by `AppModule`;
- `data-source.ts` — a CLI-only DataSource for the `typeorm` commands (requires `DATABASE_URL`);
- `migrations/` — migration classes plus `index.ts`, the **explicit list** of every migration.

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

`db:reset` drops every table and type in the database and replays all migrations from
scratch — a factory reset for a broken or half-migrated **development** database. Never point
it at a database whose data you care about.

`DATABASE_URL` may also come from the root `.env` — the CLI DataSource loads it the same way
the server does. A variable already set in the shell wins over the `.env` value.

## Changing the schema: the workflow

1. Edit the entity (add a column, index, table, …).
2. Generate a migration against a Postgres database that has the **current** (pre-change)
   schema:

   ```bash
   DATABASE_URL=... yarn workspace server migration:generate src/db/migrations/AddFrequencyRank
   ```

   TypeORM diffs the entities against that database and writes
   `src/db/migrations/<timestamp>-AddFrequencyRank.ts` with `up()`/`down()`.

3. **Register the class in `src/db/migrations/index.ts`** — both the CLI and the running
   server read this explicit array (an explicit list resolves identically from ts-node and
   from the compiled `dist`, unlike path globs). A generated migration that is not listed
   there will never run.
4. Review the generated SQL, run `yarn format`, and commit the migration file together with
   the entity change in the same PR.

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

`AddEntryWordTrigramIndex` runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` (trigram search,
issue #278). `pg_trgm` ships with every Postgres distribution and is a _trusted_ extension
since Postgres 13, so the database owner can create it without superuser rights; managed
services (RDS, Cloud SQL, Supabase, Neon, …) allow it too. If the migration fails with a
permission error, create the extension once as a superuser and rerun `migration:run`.

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

The server config sets `migrationsRun: true` for Postgres, so on every start TypeORM:

1. reads the `migrations` table to see what has already been applied;
2. executes every pending migration in order, each inside a transaction, and records it;
3. only then lets Nest accept requests.

A failed migration rolls back its transaction and **the server does not start** — deliberately
fail-fast: better a service that is down than one running against a schema its code does not
match. A start with no pending migrations is effectively instant.

Deploying therefore is just: ship the new code (which includes the new migration files) and
restart the service. The manual `migration:run` / `migration:revert` commands remain available
for applying ahead of a restart or rolling back.

## Adopting a pre-existing database

Databases created by the old `synchronize` mode already have all the tables, but no
`migrations` bookkeeping. Mark the baseline as applied **without executing it**, one time:

```bash
DATABASE_URL=... yarn workspace server migration:run --fake
```

After that, `migration:show` reports the baseline as applied and only future migrations will
actually execute. Skipping this step would make the first `migration:run` (or server start)
fail on `CREATE TABLE` statements for tables that already exist.

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
- **A new migration never runs** — check it is exported from `src/db/migrations/index.ts`;
  the array is the single source of truth for both the CLI and the server.
- **Driver mismatch errors** — entity column types are locked to a driver at import time
  (`checkIsPostgres`, see [environment.md](./environment.md#database-driver-locking)). The CLI
  DataSource loads `.env` before importing the entities for exactly this reason; always run
  migrations through the workspace scripts, not by invoking `typeorm` on ad-hoc files.
