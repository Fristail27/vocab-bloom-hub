/**
 * The site's own requests to the API (issue #483): the word pages rendered on
 * the server and the headword walk behind the sitemaps and the browse index
 * all leave the site's process from one address, and the public prefix
 * budgets by address — a walk of a thousand list pages emptied the budget a
 * word page needed, and the page answered 500. With `INTERNAL_API_TOKEN`
 * set on both sides these requests carry the token and the server does not
 * count them; without it, nothing changes on the wire.
 */
export const INTERNAL_API_TOKEN_HEADER = 'x-internal-token';

/** The header of the instance's own traffic, or nothing when no token is configured */
export const internalApiHeaders = (
  env: Record<string, string | undefined> = process.env,
): Record<string, string> => {
  const token = env.INTERNAL_API_TOKEN?.trim();
  return token ? { [INTERNAL_API_TOKEN_HEADER]: token } : {};
};

/** A page render waits this long at most for the budget to free (`Retry-After`) */
export const RETRY_429_MAX_WAIT_MS = 5_000;

/** The wait a `429` asks for, in ms; null when it is missing, malformed or too long to wait in a render */
export const retryAfterWithin = (res: Response, maxMs: number = RETRY_429_MAX_WAIT_MS): number | null => {
  const seconds = Number(res.headers.get('retry-after'));
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const ms = seconds * 1000;
  return ms <= maxMs ? ms : null;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });

/**
 * A GET that is repeated once after a `429` when the server says the budget
 * frees within a few seconds: a page rendered while the budget is briefly
 * exhausted (the token not configured, a crawler burst) should not fail for
 * that. A longer `Retry-After` is not waited for — the caller answers as if
 * the API were unavailable, without a page that takes a minute to fail
 */
export const getWithOneRetry = async (
  get: () => Promise<Response>,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<Response> => {
  const first = await get();
  if (first.status !== 429) return first;
  const wait = retryAfterWithin(first);
  if (wait === null) return first;
  await sleep(wait);
  return get();
};
