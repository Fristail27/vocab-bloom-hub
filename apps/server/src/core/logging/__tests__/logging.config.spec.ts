import { ConfigurationError } from '../../../../configuration';
import { getLogFormat, getLogLevel, isRequestId } from '../logging.config';

describe('getLogLevel (LOG_LEVEL → pino level, issue #280)', () => {
  it.each([
    ['verbose', 'trace'],
    ['debug', 'debug'],
    ['log', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
    ['fatal', 'fatal'],
  ])("maps Nest's %s to %s", (nest, pino) => {
    expect(getLogLevel({ LOG_LEVEL: nest })).toBe(pino);
  });

  it("accepts pino's own names and ignores case and whitespace", () => {
    expect(getLogLevel({ LOG_LEVEL: 'info' })).toBe('info');
    expect(getLogLevel({ LOG_LEVEL: 'trace' })).toBe('trace');
    expect(getLogLevel({ LOG_LEVEL: ' WARN ' })).toBe('warn');
  });

  it('defaults to debug in development and info elsewhere', () => {
    expect(getLogLevel({ NODE_ENV: 'development' })).toBe('debug');
    expect(getLogLevel({ NODE_ENV: 'production' })).toBe('info');
    expect(getLogLevel({})).toBe('info');
  });

  it('falls back to the default on an unknown value (documented behaviour)', () => {
    expect(getLogLevel({ LOG_LEVEL: 'loud', NODE_ENV: 'production' })).toBe('info');
    expect(getLogLevel({ LOG_LEVEL: '', NODE_ENV: 'development' })).toBe('debug');
  });
});

describe('getLogFormat (LOG_FORMAT)', () => {
  it('is json in production and pretty elsewhere when unset', () => {
    expect(getLogFormat({ NODE_ENV: 'production' })).toBe('json');
    expect(getLogFormat({ NODE_ENV: 'development' })).toBe('pretty');
    expect(getLogFormat({})).toBe('pretty');
  });

  it('honours an explicit value in either environment', () => {
    expect(getLogFormat({ NODE_ENV: 'production', LOG_FORMAT: 'pretty' })).toBe('pretty');
    expect(getLogFormat({ NODE_ENV: 'development', LOG_FORMAT: ' JSON ' })).toBe('json');
  });

  it('refuses anything else — a typo must not silently switch the format', () => {
    expect(() => getLogFormat({ LOG_FORMAT: 'text' })).toThrow(ConfigurationError);
    expect(() => getLogFormat({ LOG_FORMAT: 'text' })).toThrow(
      'LOG_FORMAT must be one of json, pretty, got "text"',
    );
  });
});

describe('isRequestId (an X-Request-Id worth reusing)', () => {
  it('accepts the ids proxies generate', () => {
    expect(isRequestId('6f1c2b3a-1234-4abc-9def-0123456789ab')).toBe(true);
    expect(isRequestId('req-42')).toBe(true);
    expect(isRequestId('trace.7_A')).toBe(true);
  });

  it('rejects what could break a line or is not a single header', () => {
    expect(isRequestId('')).toBe(false);
    expect(isRequestId('with space')).toBe(false);
    expect(isRequestId('new\nline')).toBe(false);
    expect(isRequestId('a'.repeat(129))).toBe(false);
    expect(isRequestId(['a', 'b'])).toBe(false);
    expect(isRequestId(undefined)).toBe(false);
  });
});
