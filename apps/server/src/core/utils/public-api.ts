import { timingSafeEqual } from 'node:crypto';
import { ConfigurationError } from '../../../configuration';

export const PUBLIC_API_PREFIX = '/api/v1';
export const PUBLIC_API_VERSION = '1';
export const API_VERSION_HEADER = 'X-API-Version';

// Everything that is not the public prefix is the admin surface: the
// dictionary editing routes, the settings store and the login
export const ADMIN_API_PREFIXES = ['/api/en', '/api/settings', '/api/auth'];

export type RateLimitT = { limit: number; ttl: number };

// Requests per window for the whole public prefix; every client shares the
// budget per IP (no API keys yet)
export const DEFAULT_PUBLIC_API_RATE_LIMIT: RateLimitT = { limit: 100, ttl: 60_000 };

/**
 * `PUBLIC_API_RATE_LIMIT=<requests>/<seconds>`, e.g. `100/60` (the default)
 * or `1000/60`. Throws on anything else so a typo does not silently drop
 * the limit.
 */
export const parsePublicApiRateLimit = (raw: string | undefined): RateLimitT => {
  const value = raw?.trim();
  if (!value) return DEFAULT_PUBLIC_API_RATE_LIMIT;
  const match = /^(\d+)\/(\d+)$/.exec(value);
  const limit = match ? Number(match[1]) : NaN;
  const seconds = match ? Number(match[2]) : NaN;
  if (!match || limit < 1 || seconds < 1) {
    throw new ConfigurationError(
      `PUBLIC_API_RATE_LIMIT must look like "<requests>/<seconds>", e.g. 100/60; got "${value}".`,
    );
  }
  return { limit, ttl: seconds * 1000 };
};

// Read per request (not at import time) so the throttler picks the value up
// however the environment was loaded; an invalid value fails startup earlier
export const getPublicApiRateLimit = (env: NodeJS.ProcessEnv = process.env): RateLimitT => {
  try {
    return parsePublicApiRateLimit(env.PUBLIC_API_RATE_LIMIT);
  } catch {
    return DEFAULT_PUBLIC_API_RATE_LIMIT;
  }
};

/**
 * The @Throttle() setting of every public controller: one budget for the
 * whole prefix, sized by PUBLIC_API_RATE_LIMIT and read per request so the
 * environment decides, not the import order
 */
export const PUBLIC_API_THROTTLE = {
  default: { limit: () => getPublicApiRateLimit().limit, ttl: () => getPublicApiRateLimit().ttl },
};

/**
 * The header the instance's own website sends with its server-side requests
 * (the word pages, the headword walk behind the sitemaps and the browse
 * index): a request carrying the configured `INTERNAL_API_TOKEN` is not
 * counted against the public rate budget. Without the exemption the site
 * shares one client IP — and one budget — with its own thousand-request
 * walk, and a word page rendered during the walk gets `429` and fails.
 */
export const INTERNAL_API_TOKEN_HEADER = 'x-internal-token';
/** Shorter secrets are refused at startup: the header bypasses the rate limit */
export const INTERNAL_API_TOKEN_MIN_LENGTH = 16;

/** `INTERNAL_API_TOKEN`: unset or blank means no exemption; a short value throws */
export const parseInternalApiToken = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;
  if (value.length < INTERNAL_API_TOKEN_MIN_LENGTH) {
    throw new ConfigurationError(
      `INTERNAL_API_TOKEN must be at least ${INTERNAL_API_TOKEN_MIN_LENGTH} characters (e.g. \`openssl rand -hex 32\`); got ${value.length}.`,
    );
  }
  return value;
};

// Read per request, like the rate limit; an invalid value failed startup already
export const getInternalApiToken = (env: NodeJS.ProcessEnv = process.env): string | null => {
  try {
    return parseInternalApiToken(env.INTERNAL_API_TOKEN);
  } catch {
    return null;
  }
};

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Whether a request carries the instance's own token (a constant-time comparison) */
export const isInternalRequest = (
  headers: Record<string, string | string[] | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const token = getInternalApiToken(env);
  const sent = headerValue(headers[INTERNAL_API_TOKEN_HEADER]);
  if (!token || !sent) return false;
  const expected = Buffer.from(token);
  const given = Buffer.from(sent);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

// Seconds a shared cache may keep a public GET answer (Cache-Control
// max-age); the content ETag still revalidates it in one round trip
export const DEFAULT_PUBLIC_API_CACHE_MAX_AGE = 3600;

/**
 * `PUBLIC_API_CACHE_MAX_AGE=<seconds>`, a non-negative integer; `0` makes
 * every cache revalidate on each use. Throws on anything else.
 */
export const parsePublicApiCacheMaxAge = (raw: string | undefined): number => {
  const value = raw?.trim();
  if (!value) return DEFAULT_PUBLIC_API_CACHE_MAX_AGE;
  if (!/^\d+$/.test(value)) {
    throw new ConfigurationError(
      `PUBLIC_API_CACHE_MAX_AGE must be a number of seconds, e.g. 3600 (the default) or 0; got "${value}".`,
    );
  }
  return Number(value);
};

// Read per request, like the rate limit; an invalid value failed startup already
export const getPublicApiCacheMaxAge = (env: NodeJS.ProcessEnv = process.env): number => {
  try {
    return parsePublicApiCacheMaxAge(env.PUBLIC_API_CACHE_MAX_AGE);
  } catch {
    return DEFAULT_PUBLIC_API_CACHE_MAX_AGE;
  }
};

/** A boolean variable: unset or empty is `true`; anything but true/false words throws ConfigurationError */
export const parseFlag = (name: string, raw: string | undefined): boolean => {
  const value = raw?.trim().toLowerCase();
  if (value === undefined || value === '') return true;
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  throw new ConfigurationError(`${name} must be true or false; got "${raw}".`);
};

/**
 * Which API surfaces this instance serves: `PUBLIC_API_ENABLED` (the
 * read-only `/api/v1`) and `ADMIN_API_ENABLED` (everything else). Both
 * default to on; a public-only instance hides the admin routes entirely
 * (404), an admin-only one hides the public prefix.
 */
export const getApiSurfaces = (
  env: NodeJS.ProcessEnv = process.env,
): { publicApi: boolean; adminApi: boolean } => ({
  publicApi: parseFlag('PUBLIC_API_ENABLED', env.PUBLIC_API_ENABLED),
  adminApi: parseFlag('ADMIN_API_ENABLED', env.ADMIN_API_ENABLED),
});

/**
 * The request path as the client sent it. Express rewrites `req.path` /
 * `req.url` relative to the mount point inside middleware (a wildcard
 * mount leaves `/`), so the original URL is the only reliable source
 */
export const requestPath = (req: { originalUrl?: string; url: string }): string =>
  (req.originalUrl ?? req.url).split('?')[0];

export const isPublicApiPath = (path: string): boolean =>
  path === PUBLIC_API_PREFIX || path.startsWith(`${PUBLIC_API_PREFIX}/`);

export const isAdminApiPath = (path: string): boolean =>
  ADMIN_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/** Validates the public-API settings at startup; throws ConfigurationError */
export const assertPublicApiConfig = (env: NodeJS.ProcessEnv = process.env): void => {
  parsePublicApiRateLimit(env.PUBLIC_API_RATE_LIMIT);
  parsePublicApiCacheMaxAge(env.PUBLIC_API_CACHE_MAX_AGE);
  parseInternalApiToken(env.INTERNAL_API_TOKEN);
  const surfaces = getApiSurfaces(env);
  if (!surfaces.publicApi && !surfaces.adminApi) {
    throw new ConfigurationError(
      'PUBLIC_API_ENABLED and ADMIN_API_ENABLED are both false — the server would serve nothing.',
    );
  }
};
