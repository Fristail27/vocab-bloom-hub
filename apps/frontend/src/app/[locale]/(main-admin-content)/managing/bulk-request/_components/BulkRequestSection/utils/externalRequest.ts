import { AuthHeaderModeE, BulkRequestConfigT } from '../types';
import { ExternalResponseT } from './responseMappers';

export type ExternalRequestErrorKindT = 'http' | 'network' | 'aborted';

/** A failed external request after every retry; `kind: 'network'` usually means CORS */
export class ExternalRequestError extends Error {
  constructor(
    public readonly kind: ExternalRequestErrorKindT,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ExternalRequestError';
  }
}

/** Builds the request headers: auth from the key, then the extra "Name: value" lines */
export const buildHeaders = (config: BulkRequestConfigT): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  for (const line of config.extraHeaders.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (name) headers[name] = value;
  }

  const key = config.apiKey.trim();
  if (key) {
    if (config.authHeaderMode === AuthHeaderModeE.bearer) headers['Authorization'] = `Bearer ${key}`;
    else if (config.authHeaderMode === AuthHeaderModeE.x_api_key) headers['x-api-key'] = key;
    else if (config.customAuthHeaderName.trim()) headers[config.customAuthHeaderName.trim()] = key;
  }

  return headers;
};

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new ExternalRequestError('aborted', 'cancelled'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ExternalRequestError('aborted', 'cancelled'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const retryDelay = (attempt: number, retryAfterHeader: string | null): number => {
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (!Number.isNaN(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, MAX_DELAY_MS);
  // exponential backoff with a little jitter so parallel workers do not retry in lockstep
  const backoff = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return backoff + Math.floor(Math.random() * 100);
};

export type SendExternalRequestOptions = {
  url: string;
  headers: Record<string, string>;
  body: string;
  maxRetries: number;
  signal?: AbortSignal;
  // injectable for tests
  fetchFn?: typeof fetch;
};

/**
 * POSTs the body to the external URL. Retries 429 / 5xx with backoff
 * (honouring Retry-After), never retries other 4xx, and turns a fetch
 * TypeError into a `network` error — in a browser that is almost always a CORS
 * rejection, so the caller can say so.
 */
export const sendExternalRequest = async ({
  url,
  headers,
  body,
  maxRetries,
  signal,
  fetchFn = fetch,
}: SendExternalRequestOptions): Promise<ExternalResponseT> => {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new ExternalRequestError('aborted', 'cancelled');

    let res: Response;
    try {
      res = await fetchFn(url, { method: 'POST', headers, body, signal });
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw new ExternalRequestError('aborted', 'cancelled');
      }
      if (attempt < maxRetries) {
        await sleep(retryDelay(attempt, null), signal);
        continue;
      }
      throw new ExternalRequestError(
        'network',
        `network error: ${err instanceof Error ? err.message : String(err)} (blocked by CORS or the host is unreachable)`,
      );
    }

    const text = await res.text();
    if (res.ok) {
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = undefined;
      }
      return { status: res.status, json, text };
    }

    if (RETRYABLE_STATUSES.has(res.status) && attempt < maxRetries) {
      await sleep(retryDelay(attempt, res.headers.get('Retry-After')), signal);
      continue;
    }

    throw new ExternalRequestError('http', `HTTP ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
};
