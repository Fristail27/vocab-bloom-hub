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
  TranslationsQuery,
  TranslationsResponse,
  Word,
  WordFilters,
  WordResponse,
  WordsResponse,
} from './types';

export const PUBLIC_API_PREFIX = '/api/v1';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

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
};

export type RequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
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
  }

  // ------------------------------------------------------------- search

  /** Flat search: relevance tiers, typo tolerance, no meanings joined */
  search(request: SearchRequest, options?: RequestOptions): Promise<SearchResponse> {
    return this.post('/search', request, options);
  }

  /** Paged search with meanings and translations on request */
  searchDetailed(request: DetailedSearchRequest, options?: RequestOptions): Promise<DetailedSearchResponse> {
    return this.post('/search/detailed', request, options);
  }

  // -------------------------------------------------------------- reads

  /** All entries of a headword (parts of speech, forms, meanings, translations, links) */
  word(headword: string, options?: RequestOptions): Promise<HeadwordResponse> {
    return this.get(`/words/${encodeURIComponent(headword)}`, undefined, options);
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
    const response = await this.send(url, { method: 'GET', headers, signal: options?.signal });
    if (response.status === 304 && cached) return cached.body as T;
    if (!response.ok) throw await errorFromResponse(response);
    const body = (await response.json()) as T;
    const etag = response.headers.get('etag');
    if (this.cache && etag) this.cache.set(url, { etag, body });
    return body;
  }

  private async post<T>(path: string, body: object, options?: RequestOptions): Promise<T> {
    const response = await this.send(this.url(path), {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    if (!response.ok) throw await errorFromResponse(response);
    return (await response.json()) as T;
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(url, init);
    } catch (cause) {
      throw new NetworkError(
        `Request to ${url} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      );
    }
  }
}
