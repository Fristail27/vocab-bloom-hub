import { ConfigurationError } from '../../../configuration';

/**
 * Size of the Postgres connection pool (issue #333). The pg driver defaults
 * to 10 connections; a public instance under load or a managed Postgres with
 * a low connection limit needs a knob — the pool metrics (vbh_db_pool_*)
 * show saturation, DB_POOL_SIZE is what acts on it. Keep
 * replicas × DB_POOL_SIZE under the managed instance's connection limit.
 */
export const DEFAULT_DB_POOL_SIZE = 10;

/** The pg driver's own default: an idle client is closed after 10 seconds */
export const DEFAULT_DB_POOL_IDLE_TIMEOUT_SECONDS = 10;

export type DbPoolConfig = {
  /** Maximum clients in the pool (pg `max`) */
  max: number;
  /** Seconds an idle client survives before it is closed; 0 keeps idle clients forever */
  idleTimeoutSeconds: number;
};

/** Parses DB_POOL_SIZE: a whole number of connections, at least 1; blank keeps the default */
export const parseDbPoolSize = (raw: string | undefined): number => {
  const value = raw?.trim();
  if (!value) return DEFAULT_DB_POOL_SIZE;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new ConfigurationError(
      `DB_POOL_SIZE must be a whole number of connections, at least 1 (got "${raw}"). ` +
        `Unset it to use the default of ${DEFAULT_DB_POOL_SIZE}.`,
    );
  }
  return Number(value);
};

/** Parses DB_POOL_IDLE_TIMEOUT: whole seconds, 0 keeps idle connections open; blank keeps the default */
export const parseDbPoolIdleTimeout = (raw: string | undefined): number => {
  const value = raw?.trim();
  if (!value) return DEFAULT_DB_POOL_IDLE_TIMEOUT_SECONDS;
  if (!/^\d+$/.test(value)) {
    throw new ConfigurationError(
      `DB_POOL_IDLE_TIMEOUT must be a whole number of seconds (0 keeps idle connections open, got "${raw}"). ` +
        `Unset it to use the default of ${DEFAULT_DB_POOL_IDLE_TIMEOUT_SECONDS} s.`,
    );
  }
  return Number(value);
};

export const getDbPoolConfig = (env: NodeJS.ProcessEnv = process.env): DbPoolConfig => ({
  max: parseDbPoolSize(env.DB_POOL_SIZE),
  idleTimeoutSeconds: parseDbPoolIdleTimeout(env.DB_POOL_IDLE_TIMEOUT),
});
