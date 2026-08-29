import { ConfigurationError } from '../../../configuration';

/**
 * How long a graceful stop may take (issue #315). On SIGTERM / SIGINT Nest
 * stops accepting connections, waits for the requests in flight and closes
 * the database pool; a request that outlives this budget (a running
 * dictionary import, a stuck connection) must not keep the process alive
 * until the process manager gives up and sends SIGKILL — the watchdog exits
 * on its own, with a log line saying why.
 */
export const DEFAULT_SHUTDOWN_TIMEOUT_SECONDS = 30;

/** Parses SHUTDOWN_TIMEOUT: whole seconds, at least 1; blank keeps the default */
export const parseShutdownTimeout = (raw: string | undefined): number => {
  const value = raw?.trim();
  if (!value) return DEFAULT_SHUTDOWN_TIMEOUT_SECONDS;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new ConfigurationError(
      `SHUTDOWN_TIMEOUT must be a whole number of seconds, at least 1 (got "${raw}"). ` +
        `Unset it to use the default of ${DEFAULT_SHUTDOWN_TIMEOUT_SECONDS} s.`,
    );
  }
  return Number(value);
};

export const getShutdownTimeout = (env: NodeJS.ProcessEnv = process.env): number =>
  parseShutdownTimeout(env.SHUTDOWN_TIMEOUT);
