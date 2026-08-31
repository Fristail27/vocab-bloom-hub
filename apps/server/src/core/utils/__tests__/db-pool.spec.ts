import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_DB_POOL_IDLE_TIMEOUT_SECONDS,
  DEFAULT_DB_POOL_SIZE,
  getDbPoolConfig,
  parseDbPoolIdleTimeout,
  parseDbPoolSize,
} from '../db-pool';
import { ConfigurationError } from '../../../../configuration';

describe('DB_POOL_SIZE / DB_POOL_IDLE_TIMEOUT (issue #333)', () => {
  it('defaults to the pg driver values when unset or blank', () => {
    expect(parseDbPoolSize(undefined)).toBe(DEFAULT_DB_POOL_SIZE);
    expect(parseDbPoolSize('  ')).toBe(10);
    expect(parseDbPoolIdleTimeout(undefined)).toBe(DEFAULT_DB_POOL_IDLE_TIMEOUT_SECONDS);
    expect(parseDbPoolIdleTimeout('')).toBe(10);
    expect(getDbPoolConfig({})).toEqual({ max: 10, idleTimeoutSeconds: 10 });
  });

  it('accepts a whole pool size of at least 1', () => {
    expect(parseDbPoolSize('1')).toBe(1);
    expect(parseDbPoolSize(' 25 ')).toBe(25);
    expect(getDbPoolConfig({ DB_POOL_SIZE: '5' }).max).toBe(5);
  });

  it('accepts whole idle-timeout seconds, 0 included', () => {
    expect(parseDbPoolIdleTimeout('0')).toBe(0);
    expect(parseDbPoolIdleTimeout(' 300 ')).toBe(300);
    expect(getDbPoolConfig({ DB_POOL_IDLE_TIMEOUT: '60' }).idleTimeoutSeconds).toBe(60);
  });

  it('rejects anything else at startup', () => {
    for (const bad of ['0', '-5', '2.5', '10c', 'abc']) {
      expect(() => parseDbPoolSize(bad)).toThrow(ConfigurationError);
    }
    for (const bad of ['-1', '1.5', '30s', 'abc']) {
      expect(() => parseDbPoolIdleTimeout(bad)).toThrow(ConfigurationError);
    }
  });
});
