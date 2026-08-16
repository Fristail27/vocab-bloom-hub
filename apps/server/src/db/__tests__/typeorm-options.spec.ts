import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as path from 'path';

type TypeOrmOptionsModule = typeof import('../typeorm-options');

// checkIsPostgres locks the driver in module state at the first call, so every
// scenario loads a fresh copy of the module (entities included)
const loadFreshOptions = (): TypeOrmOptionsModule => {
  let mod: TypeOrmOptionsModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../typeorm-options') as TypeOrmOptionsModule;
  });
  return mod!;
};

describe('buildTypeOrmOptions (issue #181)', () => {
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

  describe('with DATABASE_URL (Postgres)', () => {
    it('never synchronizes and runs migrations on start instead', () => {
      process.env.DATABASE_URL = 'postgres://db';
      const { buildTypeOrmOptions } = loadFreshOptions();

      const options = buildTypeOrmOptions();

      expect(options.type).toBe('postgres');
      expect(options.synchronize).toBe(false);
      expect(options.migrationsRun).toBe(true);
      expect(options.migrations).not.toHaveLength(0);
    });

    it('stays on migrations even in development mode', () => {
      process.env.DATABASE_URL = 'postgres://db';
      const prevNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        const { buildTypeOrmOptions } = loadFreshOptions();

        const options = buildTypeOrmOptions();

        expect(options.synchronize).toBe(false);
        expect(options.migrationsRun).toBe(true);
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
      }
    });
  });

  describe('without DATABASE_URL (SQLite dev fallback)', () => {
    it('synchronizes the dev database and does not attach migrations', () => {
      const { buildTypeOrmOptions } = loadFreshOptions();

      const options = buildTypeOrmOptions();

      expect(options.type).toBe('better-sqlite3');
      expect(options.synchronize).toBe(true);
      expect(options.migrationsRun).toBeUndefined();
      expect(options.migrations).toBeUndefined();
    });

    it('points at dev.sqlite in the repo root', () => {
      const { buildTypeOrmOptions } = loadFreshOptions();

      const options = buildTypeOrmOptions() as { database?: string };

      expect(options.database).toBe(path.join(process.cwd(), '..', '..', 'dev.sqlite'));
    });
  });

  it('registers every entity in both modes', () => {
    const { buildTypeOrmOptions, DB_ENTITIES } = loadFreshOptions();

    expect(DB_ENTITIES.length).toBeGreaterThanOrEqual(6);
    expect(buildTypeOrmOptions().entities).toBe(DB_ENTITIES);
  });
});
