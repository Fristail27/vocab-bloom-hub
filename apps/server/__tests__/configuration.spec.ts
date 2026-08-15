import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { assertRequiredConfig, ConfigurationError } from '../configuration';

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
    USERNAME: 'admin',
    PASSWORD: 'secret',
  });

  it('passes with USERNAME and PASSWORD set (dev, sqlite fallback allowed)', () => {
    expect(() => assertRequiredConfig(validEnv())).not.toThrow();
  });

  it('fails when USERNAME is missing', () => {
    const env = validEnv();
    delete env.USERNAME;
    expect(() => assertRequiredConfig(env)).toThrow(ConfigurationError);
    expect(() => assertRequiredConfig(env)).toThrow(/USERNAME/);
  });

  it('fails when PASSWORD is missing even though the OS provides USERNAME', () => {
    // The fail-open scenario: .env did not load, USERNAME comes from the OS,
    // PASSWORD would silently hash as the string "undefined"
    const env: NodeJS.ProcessEnv = { USERNAME: 'os-user' };
    expect(() => assertRequiredConfig(env)).toThrow(ConfigurationError);
    expect(() => assertRequiredConfig(env)).toThrow(/PASSWORD/);
  });

  it('lists every missing variable at once', () => {
    expect(() => assertRequiredConfig({})).toThrow(/USERNAME, PASSWORD/);
  });

  it('rejects blank values, not only missing ones', () => {
    expect(() => assertRequiredConfig({ USERNAME: 'admin', PASSWORD: '   ' })).toThrow(/PASSWORD/);
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
