import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

export default () => ({
  version: packageJson.version,
});

export class ConfigurationError extends Error {}

// USERNAME alone proves nothing: the OS commonly sets it to the current system
// user even when the .env file failed to load, and PASSWORD would then silently
// hash as the literal string "undefined". Failing fast closes that fail-open login.
export const assertRequiredConfig = (env: NodeJS.ProcessEnv = process.env): void => {
  const missing = ['USERNAME', 'PASSWORD'].filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Check that the root .env file exists or that the variables are set in the process environment.',
    );
  }

  if (env.NODE_ENV === 'production' && !env.DATABASE_URL) {
    throw new ConfigurationError(
      'DATABASE_URL must be set in production — refusing to fall back to the local SQLite database.',
    );
  }
};

// Entity column types are resolved inside decorators at import time, so the
// driver choice is locked at the first call and every later call stays
// consistent with the types the entities were compiled with
let lockedIsPostgres: boolean | undefined;

export const checkIsPostgres = (): boolean => {
  lockedIsPostgres ??= !!process.env.DATABASE_URL;
  return lockedIsPostgres;
};

// Detects entry points that imported the entities before the environment was
// loaded: the column types are already locked to the wrong driver in that case
export const assertDatabaseDriverConsistent = (env: NodeJS.ProcessEnv = process.env): void => {
  const wantsPostgres = !!env.DATABASE_URL;
  if (lockedIsPostgres !== undefined && lockedIsPostgres !== wantsPostgres) {
    throw new ConfigurationError(
      `Database driver mismatch: entity column types were locked for ${lockedIsPostgres ? 'Postgres' : 'SQLite'} ` +
        `at import time, but the environment now resolves to ${wantsPostgres ? 'Postgres' : 'SQLite'}. ` +
        'Load the environment before importing any entities.',
    );
  }
};

export const getVersion = () => packageJson.version;
