/**
 * Configuration of the Prometheus endpoint (issue #281): off unless
 * METRICS_ENABLED says so — a self-hosted instance must not expose its
 * internals by accident — and served at METRICS_PATH (default /metrics).
 */
export const DEFAULT_METRICS_PATH = '/metrics';

export const isMetricsEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  ['1', 'true', 'yes', 'on'].includes((env.METRICS_ENABLED ?? '').trim().toLowerCase());

export const getMetricsPath = (env: NodeJS.ProcessEnv = process.env): string => {
  const raw = (env.METRICS_PATH ?? '').trim();
  if (!raw) return DEFAULT_METRICS_PATH;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
};
