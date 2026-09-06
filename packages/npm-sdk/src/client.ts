import { MemoryCache, type ResponseCache } from './cache';
import { errorFromResponse, NetworkError } from './errors';
import type {
  DetailedSearchRequest,
  DetailedSearchResponse,
  FormsResponse,
  HeadwordResponse,
  ListWordsQuery,
  MeaningsResponse,
  MetaResponse,
  SearchRequest,
  SearchResponse,
  SuggestionCreatedResponse,
  SuggestionRequest,
  TranslationsQuery,
  TranslationsResponse,
  Word,
  WordFilters,
  WordResponse,
  WordsBatchResponse,
  WordsResponse,
} from './types';

export const PUBLIC_API_PREFIX = '/api/v1';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** A request without an answer fails after this long unless overridden (issue #352) */
export const DEFAULT_TIMEOUT_MS = 10_000;

export type ClientOptions = {
  /** Origin of the instance, e.g. `https://dict.example.com`; the client appends `/api/v1` */
  baseUrl: string;
  /** Custom fetch (polyfill, instrumentation, tests); defaults to the global one */
  fetch?: FetchLike;
  /** Headers sent with every request */
  headers?: Record<string, string>;
  /**
   * Conditional GETs on ETag: `true` for an in-memory cache, or your own
   * store. Off by default — a repeated read then always carries a payload.
   */
  cache?: boolean | ResponseCache;
  /**
   * Milliseconds before a request without an answer fails with
   * `NetworkError` (the Python client has the same 10 s default);
   * `null` disables the timeout entirely.
   */
  timeoutMs?: number | null;
};

export type RequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Overrides the client's `timeoutMs` for this call; `null` disables it */
  timeoutMs?: number | null;
};

// No regular expression: `/\/+$/` backtracks quadratically on a long run of
// slashes (CodeQL: polynomial regex on library input)
const trimTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
};

type QueryValueT = string | number | boolean | null | undefined;
type QueryT = Record<string, QueryValueT | readonly QueryValueT[]>;

// The caller's signal joined with the timeout's; by hand when AbortSignal.any
// is missing (engines allow Node 20.0, `any` landed in 20.3)
const withTimeout = (signal: AbortSignal | undefined, timeoutMs: number | null): AbortSignal | undefined => {
  if (timeoutMs === null) return signal;
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timeout]);
  const controller = new AbortController();
  if (signal.aborted) controller.abort(signal.reason);
  signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  timeout.addEventListener('abort', () => controller.abort(timeout.reason), { once: true });
  return controller.signal;
};

/**
 * Typed client of the public read-only API. Every method is one endpoint and
 * resolves to the `{ data, meta }` envelope the API answers with; failures
 * throw `VocabBloomError` (or `NotFoundError`, `RateLimitError`,
 * `NetworkError`). No authentication: the public prefix has none.
 */
export class VocabBloomClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly headers: Record<string, string>;
  private readonly cache: ResponseCache | null;
  private readonly timeoutMs: number | null;

  constructor(options: ClientOptions) {
    this.baseUrl = trimTrailingSlashes(options.baseUrl) + PUBLIC_API_PREFIX;
    const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetchImpl) {
      throw new Error(
        'No fetch available: pass one in ClientOptions.fetch (Node < 18) or use a modern runtime',
      );
    }
    this.fetchImpl = fetchImpl;
    this.headers = { Accept: 'application/json', ...options.headers };
    this.cache = options.cache === true ? new MemoryCache() : options.cache || null;
    this.timeoutMs = options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
  }

  // ------------------------------------------------------------- search

  // Both searches go as GET (issue #396): the same fields in the query string,
  // and the answer carries an ETag, so the client's cache revalidates it
  /** Flat search: relevance tiers, typo tolerance, no meanings joined */
  search(request: SearchRequest, options?: RequestOptions): Promise<SearchResponse> {
    return this.get('/search', request, options);
  }

  /** Paged search with meanings and translations on request */
  searchDetailed(request: DetailedSearchRequest, options?: RequestOptions): Promise<DetailedSearchResponse> {
    return this.get('/search/detailed', request, options);
  }

  // -------------------------------------------------------------- reads

  /** All entries of a headword (parts of speech, forms, meanings, translations, links) */
  word(headword: string, options?: RequestOptions): Promise<HeadwordResponse> {
    return this.get(`/words/${encodeURIComponent(headword)}`, undefined, options);
  }

  /**
   * Up to 50 headwords in one request (issue #397): one item per spelling
   * in request order, the spellings without an entry under `meta.not_found`.
   * Costs one request of the rate limit whatever the size of the batch.
   */
  wordsBatch(words: string[], options?: RequestOptions): Promise<WordsBatchResponse> {
    return this.post('/words/batch', { words }, options);
  }

  /** One entry by its numeric id */
  wordById(id: number, options?: RequestOptions): Promise<WordResponse> {
    return this.get(`/words/id/${id}`, undefined, options);
  }

  /** The meanings of every entry of a headword */
  meanings(headword: string, options?: RequestOptions): Promise<MeaningsResponse> {
    return this.get(`/words/${encodeURIComponent(headword)}/meanings`, undefined, options);
  }

  /** Short and per-meaning translations of a headword, optionally limited to languages */
  translations(
    headword: string,
    query?: TranslationsQuery,
    options?: RequestOptions,
  ): Promise<TranslationsResponse> {
    return this.get(`/words/${encodeURIComponent(headword)}/translations`, query, options);
  }

  /** Inflected forms of every entry of a headword */
  forms(headword: string, options?: RequestOptions): Promise<FormsResponse> {
    return this.get(`/words/${encodeURIComponent(headword)}/forms`, undefined, options);
  }

  // --------------------------------------------------------------- list

  /** One page of the filtered list, ordered by (word, id); pass `meta.next_cursor` back as `cursor` */
  words(query?: ListWordsQuery, options?: RequestOptions): Promise<WordsResponse> {
    return this.get('/words', query, options);
  }

  /** Every entry matching the filters, page after page, until the last one */
  async *iterateWords(
    query: Omit<ListWordsQuery, 'cursor'> = {},
    options?: RequestOptions,
  ): AsyncGenerator<Word> {
    let cursor: string | undefined;
    do {
      const page = await this.words({ ...query, ...(cursor && { cursor }) }, options);
      yield* page.data;
      cursor = page.meta.next_cursor ?? undefined;
    } while (cursor);
  }

  /** A random entry matching the filters */
  random(filters?: WordFilters, options?: RequestOptions): Promise<WordResponse> {
    return this.get('/random', filters, options);
  }

  // --------------------------------------------------------------- meta

  /** Versions, data license and counts of the instance */
  meta(options?: RequestOptions): Promise<MetaResponse> {
    return this.get('/meta', undefined, options);
  }

  /** The OpenAPI 3 document of the instance */
  openapi(options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.get('/openapi.json', undefined, options);
  }

  // -------------------------------------------------------- suggestions

  /**
   * Files reader feedback into the instance's moderation queue (issue #327):
   * a free-text report, or a structured edit (`kind: 'edit'`) the admin can
   * apply in one click. Strictly rate-limited per client; answers 404 for a
   * headword the dictionary does not have and 503 once the queue is full.
   */
  suggest(request: SuggestionRequest, options?: RequestOptions): Promise<SuggestionCreatedResponse> {
    return this.post('/suggestions', request, options);
  }

  // ----------------------------------------------------------- plumbing

  private url(path: string, query?: QueryT): string {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue;
      // a list is sent as a repeated key, the way the server DTOs read filters
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined && item !== null) url.searchParams.append(key, String(item));
      }
    }
    return url.toString();
  }

  private async get<T>(path: string, query?: object, options?: RequestOptions): Promise<T> {
    const url = this.url(path, query as QueryT | undefined);
    const cached = this.cache?.get(url);
    const headers: Record<string, string> = { ...this.headers, ...options?.headers };
    if (cached) {
      headers['If-None-Match'] = cached.etag;
      // Node's fetch (undici) adds `Cache-Control: no-cache` to a request that
      // carries conditional headers unless one is present already, and the
      // server then answers in full instead of 304; `max-age=0` asks for
      // revalidation and keeps undici's hands off
      headers['Cache-Control'] ??= 'max-age=0';
    }
    const response = await this.send(url, { method: 'GET', headers }, options);
    if (response.status === 304 && cached) return cached.body as T;
    if (!response.ok) throw await errorFromResponse(response);
    const body = (await response.json()) as T;
    const etag = response.headers.get('etag');
    if (this.cache && etag) this.cache.set(url, { etag, body });
    return body;
  }

  private async post<T>(path: string, body: object, options?: RequestOptions): Promise<T> {
    const response = await this.send(
      this.url(path),
      {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json', ...options?.headers },
        body: JSON.stringify(body),
      },
      options,
    );
    if (!response.ok) throw await errorFromResponse(response);
    return (await response.json()) as T;
  }

  private async send(url: string, init: RequestInit, options?: RequestOptions): Promise<Response> {
    const timeoutMs = options?.timeoutMs === undefined ? this.timeoutMs : options.timeoutMs;
    try {
      return await this.fetchImpl(url, { ...init, signal: withTimeout(options?.signal, timeoutMs) });
    } catch (cause) {
      // the timeout rejects with a DOMException, which is not an Error subclass
      if ((cause as { name?: string } | null)?.name === 'TimeoutError') {
        throw new NetworkError(`Request to ${url} timed out after ${timeoutMs} ms`, cause);
      }
      throw new NetworkError(
        `Request to ${url} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      );
    }
  }
}
