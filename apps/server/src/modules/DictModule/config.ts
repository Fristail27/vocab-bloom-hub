import { ConfigurationError } from '../../../configuration';

export type DictConfig = {
  enabled: boolean;
  host: string;
  port: number;
  maxConnections: number;
  idleMs: number;
  rateLimit: number;
};
export const DICT_LIMITS = {
  commandBytes: 6144,
  commandCharacters: 1024,
  queuedCommands: 32,
  connectionsPerIp: 8,
  rateWindowMs: 60_000,
  rateBuckets: 10_000,
  matches: 1000,
  definitions: 100,
  responseBytes: 1024 * 1024,
  shutdownMs: 5000,
};
export function getDictConfig(env: NodeJS.ProcessEnv = process.env): DictConfig {
  const enabled = env.DICT_ENABLED?.trim().toLowerCase() || 'false';
  if (!['true', 'false'].includes(enabled)) throw new ConfigurationError('DICT_ENABLED must be true or false');
  const integer = (key: string, fallback: number, max: number): number => {
    const raw = env[key]?.trim();
    const value = raw ? Number(raw) : fallback;
    if ((raw && !/^\d+$/.test(raw)) || !Number.isSafeInteger(value) || value < 1 || value > max)
      throw new ConfigurationError(`${key} must be an integer from 1 to ${max}`);
    return value;
  };
  return {
    enabled: enabled === 'true',
    host: env.DICT_HOST?.trim() || '127.0.0.1',
    port: integer('DICT_PORT', 2628, 65535),
    maxConnections: integer('DICT_MAX_CONNECTIONS', 64, 4096),
    idleMs: integer('DICT_IDLE_TIMEOUT', 60, 3600) * 1000,
    rateLimit: integer('DICT_RATE_LIMIT', 100, 10000),
  };
}
