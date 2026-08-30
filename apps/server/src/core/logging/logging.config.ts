import type { Level } from 'pino';
import { ConfigurationError } from '../../../configuration';

export type LogFormat = 'json' | 'pretty';

export const LOG_FORMATS: readonly LogFormat[] = ['json', 'pretty'];

// LOG_LEVEL keeps Nest's names (docs/environment.md); pino's own names for
// the two that differ are accepted as well
const LOG_LEVELS: Record<string, Level> = {
  verbose: 'trace',
  trace: 'trace',
  debug: 'debug',
  log: 'info',
  info: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'fatal',
};

/** The pino level for LOG_LEVEL: `debug` in development, `info` (Nest's `log`) otherwise; unknown values fall back */
export const getLogLevel = (env: NodeJS.ProcessEnv = process.env): Level => {
  const fallback: Level = env.NODE_ENV === 'development' ? 'debug' : 'info';
  const raw = env.LOG_LEVEL?.trim().toLowerCase();
  return (raw && LOG_LEVELS[raw]) || fallback;
};

/** LOG_FORMAT: one JSON object per line for a log collector, or pino-pretty for a terminal; by NODE_ENV when unset */
export const getLogFormat = (env: NodeJS.ProcessEnv = process.env): LogFormat => {
  const raw = env.LOG_FORMAT?.trim().toLowerCase();
  if (!raw) return env.NODE_ENV === 'production' ? 'json' : 'pretty';
  if ((LOG_FORMATS as string[]).includes(raw)) return raw as LogFormat;
  throw new ConfigurationError(`LOG_FORMAT must be one of ${LOG_FORMATS.join(', ')}, got "${env.LOG_FORMAT}"`);
};

// An id a proxy or a client sends in X-Request-Id is reused so one trace
// spans the hops; anything else (binary, too long, an array of headers) is
// replaced, never echoed
const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export const isRequestId = (value: unknown): value is string =>
  typeof value === 'string' && REQUEST_ID.test(value);
