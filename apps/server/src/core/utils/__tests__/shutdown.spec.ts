import { describe, expect, it } from '@jest/globals';
import { DEFAULT_SHUTDOWN_TIMEOUT_SECONDS, getShutdownTimeout, parseShutdownTimeout } from '../shutdown';
import { ConfigurationError } from '../../../../configuration';

describe('SHUTDOWN_TIMEOUT (issue #315)', () => {
  it('defaults to 30 seconds when unset or blank', () => {
    expect(parseShutdownTimeout(undefined)).toBe(DEFAULT_SHUTDOWN_TIMEOUT_SECONDS);
    expect(parseShutdownTimeout('  ')).toBe(30);
    expect(getShutdownTimeout({})).toBe(30);
  });

  it('accepts whole seconds of at least 1', () => {
    expect(parseShutdownTimeout('1')).toBe(1);
    expect(parseShutdownTimeout(' 120 ')).toBe(120);
    expect(getShutdownTimeout({ SHUTDOWN_TIMEOUT: '5' })).toBe(5);
  });

  it('rejects anything else at startup', () => {
    for (const bad of ['0', '-5', '1.5', '30s', 'abc']) {
      expect(() => parseShutdownTimeout(bad)).toThrow(ConfigurationError);
    }
  });
});
