import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

export default () => ({
  version: packageJson.version,
});

export class ConfigurationError extends Error {}

const POSTGRES_SCHEMES = ['postgres://', 'postgresql://'];
const SQLITE_SCHEME = 'sqlite:';

export type DatabaseUrlConfigT = {
  isPostgres: boolean;
  // Set only for an explicit sqlite: URL; the dev fallback (unset DATABASE_URL)
  // leaves it undefined and typeorm-options resolves the default dev.sqlite path
  sqlitePath?: string | undefined;
};

// DATABASE_URL selects the driver by scheme: postgres:// (or postgresql://)
// runs Postgres with migrations, sqlite:<path> runs better-sqlite3 with
// synchronize (e.g. sqlite:/tmp/e2e.sqlite or sqlite::memory:). An unset or
// empty variable keeps the historical dev fallback to dev.sqlite. Any other
// scheme is a hard error: guessing here would silently switch how the schema
// is managed (auto-DDL vs migrations, see issue #181).
export const parseDatabaseUrl = (raw: string | undefined): DatabaseUrlConfigT => {
  const url = raw?.trim();
  if (!url) {
    return { isPostgres: false };
  }
  if (POSTGRES_SCHEMES.some((scheme) => url.startsWith(scheme))) {
    return { isPostgres: true };
  }
  if (url.startsWith(SQLITE_SCHEME)) {
    const sqlitePath = url.slice(SQLITE_SCHEME.length);
    if (!sqlitePath) {
      throw new ConfigurationError(
        'DATABASE_URL with the sqlite: scheme must include a file path, e.g. sqlite:./dev.sqlite or sqlite::memory:',
      );
    }
    return { isPostgres: false, sqlitePath };
  }
  throw new ConfigurationError(
    `Unsupported DATABASE_URL scheme in "${url}". Use postgres://user:pass@host:port/db or sqlite:<path>.`,
  );
};

// The admin credentials live under the ADMIN_ prefix on purpose: the OS commonly
// sets a bare USERNAME to the current system user, so a project-specific name
// cannot be silently satisfied by the environment when the .env file failed to
// load. Both are still validated here so a missing .env fails fast instead of
// hashing the literal string "undefined" as a credential (fail-open login).
export const assertRequiredConfig = (env: NodeJS.ProcessEnv = process.env): void => {
  const missing = ['ADMIN_USERNAME', 'ADMIN_PASSWORD'].filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Check that the root .env file exists or that the variables are set in the process environment.',
    );
  }

  if (env.NODE_ENV === 'production' && !parseDatabaseUrl(env.DATABASE_URL).isPostgres) {
    throw new ConfigurationError(
      'DATABASE_URL must be a postgres:// connection string in production — refusing to run on SQLite.',
    );
  }
};

// Entity column types are resolved inside decorators at import time, so the
// driver choice is locked at the first call and every later call stays
// consistent with the types the entities were compiled with
let lockedIsPostgres: boolean | undefined;

export const checkIsPostgres = (): boolean => {
  lockedIsPostgres ??= parseDatabaseUrl(process.env.DATABASE_URL).isPostgres;
  return lockedIsPostgres;
};

// Detects entry points that imported the entities before the environment was
// loaded: the column types are already locked to the wrong driver in that case
export const assertDatabaseDriverConsistent = (env: NodeJS.ProcessEnv = process.env): void => {
  const wantsPostgres = parseDatabaseUrl(env.DATABASE_URL).isPostgres;
  if (lockedIsPostgres !== undefined && lockedIsPostgres !== wantsPostgres) {
    throw new ConfigurationError(
      `Database driver mismatch: entity column types were locked for ${lockedIsPostgres ? 'Postgres' : 'SQLite'} ` +
        `at import time, but the environment now resolves to ${wantsPostgres ? 'Postgres' : 'SQLite'}. ` +
        'Load the environment before importing any entities.',
    );
  }
};

export const getVersion = () => packageJson.version;
