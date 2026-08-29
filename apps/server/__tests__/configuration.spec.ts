import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resolve } from 'node:path';

import { assertRequiredConfig, ConfigurationError, parseDatabaseUrl, resolveEnvFile } from '../configuration';

type ConfigurationModule = typeof import('../configuration');

// checkIsPostgres locks its result in module state, so these tests load a
// fresh copy of the module for every scenario
const loadFreshConfiguration = (): ConfigurationModule => {
  let mod: ConfigurationModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../configuration') as ConfigurationModule;
  });
  return mod!;
};

describe('assertRequiredConfig (issue #186)', () => {
  const validEnv = (): NodeJS.ProcessEnv => ({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'secret',
  });

  it('passes with ADMIN_USERNAME and ADMIN_PASSWORD set (dev, sqlite fallback allowed)', () => {
    expect(() => assertRequiredConfig(validEnv())).not.toThrow();
  });

  it('ignores the OS-provided USERNAME and requires ADMIN_USERNAME', () => {
    // The OS commonly sets USERNAME to the current system user; it must not
    // satisfy the admin login requirement
    const env: NodeJS.ProcessEnv = { USERNAME: 'os-user', ADMIN_PASSWORD: 'secret' };
    expect(() => assertRequiredConfig(env)).toThrow(ConfigurationError);
    expect(() => assertRequiredConfig(env)).toThrow(/ADMIN_USERNAME/);
  });

  it('fails when ADMIN_USERNAME is missing', () => {
    const env = validEnv();
    delete env.ADMIN_USERNAME;
    expect(() => assertRequiredConfig(env)).toThrow(ConfigurationError);
    expect(() => assertRequiredConfig(env)).toThrow(/ADMIN_USERNAME/);
  });

  it('fails when ADMIN_PASSWORD is missing even though ADMIN_USERNAME is set', () => {
    // The fail-open scenario: .env did not load and only one credential is
    // present, so ADMIN_PASSWORD would silently hash as the string "undefined"
    const env: NodeJS.ProcessEnv = { ADMIN_USERNAME: 'admin' };
    expect(() => assertRequiredConfig(env)).toThrow(ConfigurationError);
    expect(() => assertRequiredConfig(env)).toThrow(/ADMIN_PASSWORD/);
  });

  it('lists every missing variable at once', () => {
    expect(() => assertRequiredConfig({})).toThrow(/ADMIN_USERNAME, ADMIN_PASSWORD/);
  });

  it('rejects blank values, not only missing ones', () => {
    expect(() => assertRequiredConfig({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: '   ' })).toThrow(
      /ADMIN_PASSWORD/,
    );
  });

  it('fails in production without DATABASE_URL instead of silently using SQLite', () => {
    const env = { ...validEnv(), NODE_ENV: 'production' };
    expect(() => assertRequiredConfig(env)).toThrow(ConfigurationError);
    expect(() => assertRequiredConfig(env)).toThrow(/DATABASE_URL/);
  });

  it('passes in production with DATABASE_URL set', () => {
    const env = {
      ...validEnv(),
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://db',
    };
    expect(() => assertRequiredConfig(env)).not.toThrow();
  });

  it('fails in production with an explicit sqlite: DATABASE_URL (issue #217)', () => {
    const env = {
      ...validEnv(),
      NODE_ENV: 'production',
      DATABASE_URL: 'sqlite:./prod.sqlite',
    };
    expect(() => assertRequiredConfig(env)).toThrow(ConfigurationError);
    expect(() => assertRequiredConfig(env)).toThrow(/postgres/);
  });
});

describe('parseDatabaseUrl (issue #217)', () => {
  it('falls back to the dev sqlite mode when the variable is unset or blank', () => {
    expect(parseDatabaseUrl(undefined)).toEqual({ isPostgres: false });
    expect(parseDatabaseUrl('')).toEqual({ isPostgres: false });
    expect(parseDatabaseUrl('   ')).toEqual({ isPostgres: false });
  });

  it('recognizes both postgres schemes', () => {
    expect(parseDatabaseUrl('postgres://user:pass@host:5432/db').isPostgres).toBe(true);
    expect(parseDatabaseUrl('postgresql://user:pass@host:5432/db').isPostgres).toBe(true);
  });

  it('extracts the file path from a sqlite: url', () => {
    expect(parseDatabaseUrl('sqlite:./e2e.sqlite')).toEqual({
      isPostgres: false,
      sqlitePath: './e2e.sqlite',
    });
    expect(parseDatabaseUrl('sqlite:/tmp/e2e.sqlite')).toEqual({
      isPostgres: false,
      sqlitePath: '/tmp/e2e.sqlite',
    });
    expect(parseDatabaseUrl('sqlite::memory:')).toEqual({ isPostgres: false, sqlitePath: ':memory:' });
  });

  it('rejects a sqlite: url without a path', () => {
    expect(() => parseDatabaseUrl('sqlite:')).toThrow(ConfigurationError);
  });

  it('rejects unknown schemes instead of guessing the driver', () => {
    expect(() => parseDatabaseUrl('mysql://user:pass@host/db')).toThrow(ConfigurationError);
    expect(() => parseDatabaseUrl('dev.sqlite')).toThrow(ConfigurationError);
  });
});

describe('checkIsPostgres driver locking (issue #186)', () => {
  const prevDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (prevDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = prevDatabaseUrl;
    }
  });

  it('locks the driver at the first call and keeps later calls consistent', () => {
    const cfg = loadFreshConfiguration();

    expect(cfg.checkIsPostgres()).toBe(false);
    // Env changes after the entities were imported must not flip the driver
    process.env.DATABASE_URL = 'postgres://db';
    expect(cfg.checkIsPostgres()).toBe(false);
  });

  it('locks to Postgres when DATABASE_URL is present at the first call', () => {
    process.env.DATABASE_URL = 'postgres://db';
    const cfg = loadFreshConfiguration();

    expect(cfg.checkIsPostgres()).toBe(true);
    delete process.env.DATABASE_URL;
    expect(cfg.checkIsPostgres()).toBe(true);
  });

  it('assertDatabaseDriverConsistent detects entities imported before the env was loaded', () => {
    const cfg = loadFreshConfiguration();

    cfg.checkIsPostgres(); // locked to SQLite: DATABASE_URL was absent
    process.env.DATABASE_URL = 'postgres://db'; // env "arrives" too late

    expect(() => cfg.assertDatabaseDriverConsistent()).toThrow(cfg.ConfigurationError);
    expect(() => cfg.assertDatabaseDriverConsistent()).toThrow(/mismatch/);
  });

  it('assertDatabaseDriverConsistent passes when the locked driver matches the env', () => {
    process.env.DATABASE_URL = 'postgres://db';
    const cfg = loadFreshConfiguration();

    cfg.checkIsPostgres();
    expect(() => cfg.assertDatabaseDriverConsistent()).not.toThrow();
  });

  it('assertDatabaseDriverConsistent passes when nothing is locked yet', () => {
    const cfg = loadFreshConfiguration();
    process.env.DATABASE_URL = 'postgres://db';

    expect(() => cfg.assertDatabaseDriverConsistent()).not.toThrow();
  });
});

describe('resolveEnvFile (issue #315)', () => {
  it('falls back to the path the caller resolved when ENV_FILE is unset or blank', () => {
    expect(resolveEnvFile('/repo/.env', {})).toEqual({ path: '/repo/.env', explicit: false });
    expect(resolveEnvFile('/repo/.env', { ENV_FILE: '   ' })).toEqual({ path: '/repo/.env', explicit: false });
  });

  it('uses ENV_FILE when set, as an absolute path, and marks it explicit', () => {
    expect(resolveEnvFile('/repo/.env', { ENV_FILE: '/etc/vocab-bloom-hub/.env' })).toEqual({
      path: '/etc/vocab-bloom-hub/.env',
      explicit: true,
    });
    const relative = resolveEnvFile('/repo/.env', { ENV_FILE: 'config/.env' });
    expect(relative.explicit).toBe(true);
    expect(relative.path).toBe(resolve('config/.env'));
  });
});
