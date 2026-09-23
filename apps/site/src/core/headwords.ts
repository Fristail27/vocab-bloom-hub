import type { PublicWordsV1ResT } from 'server/types';

import { serverApiBase } from './apiBase';
import { internalApiHeaders } from './internalApi';
import { nodeFetch } from './nodeFetch';

/**
 * The headword index of the instance (issues #479, #480): every base-form
 * headword the public list API enumerates, walked once and kept in the
 * process. The word sitemaps are cut from it and the browse pages page
 * through it — the enumeration is the expensive part (a thousand list
 * requests for the full dictionary, against the public rate budget), the
 * consumers are cheap.
 *
 * The walk honours `429` (waits for `Retry-After`, then goes on from the
 * same page), refuses to start while the instance reports not ready (a
 * first-start import answers partial lists with `200`), and a failed or
 * empty walk is never kept: the previous index stays in service, the next
 * attempt waits a minute. A stale index is refreshed in the background.
 */
export type HeadwordIndexT = {
  /** Every headword, in the order of the list API (word, id) */
  words: string[];
  /** The dictionary's newest change (`Last-Modified` of the list); null when the API sends none */
  lastModified: Date | null;
  builtAt: number;
};

export const INDEX_TTL_MS = 24 * 3600 * 1000;
/** A failed walk is not retried before this */
export const RETRY_AFTER_FAILURE_MS = 60_000;
/** The API caps a list page at this many entries */
const PAGE_LIMIT = 100;
const DEFAULT_429_WAIT_MS = 60_000;
const MAX_429_WAIT_MS = 120_000;
/** A page rate-limited this many times in a row is given up on */
const MAX_429_RETRIES = 10;
/** A hard stop against a cursor that never ends: two million headwords */
const MAX_PAGES = 20_000;

export type HeadwordIndexDepsT = {
  /** A GET of a URL; not Next's `fetch`, whose options would bind the walk to the page being rendered */
  fetch: (url: string) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  warn: (message: string) => void;
  apiBase: () => string;
};

const retryAfterMs = (res: Response): number => {
  const header = res.headers.get('retry-after');
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_429_WAIT_MS);
  return DEFAULT_429_WAIT_MS;
};

const walkHeadwords = async (deps: HeadwordIndexDepsT): Promise<HeadwordIndexT> => {
  const base = deps.apiBase();
  const ready = await deps.fetch(`${base}/ready`);
  if (!ready.ok) throw new Error(`the instance is not ready (${ready.status})`);

  const words = new Set<string>();
  let lastModified: Date | null = null;
  let cursor: string | undefined;
  let retries = 0;
  for (let page = 0; page < MAX_PAGES;) {
    const query = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (cursor) query.set('cursor', cursor);
    const res = await deps.fetch(`${base}/v1/words?${query}`);
    if (res.status === 429) {
      retries += 1;
      if (retries > MAX_429_RETRIES) throw new Error('the list is rate-limited for too long');
      await deps.sleep(retryAfterMs(res));
      continue;
    }
    if (!res.ok) throw new Error(`GET /v1/words answered ${res.status}`);
    retries = 0;
    page += 1;
    const { data, meta } = (await res.json()) as PublicWordsV1ResT;
    const modified = res.headers.get('last-modified');
    if (modified && !lastModified) {
      const date = new Date(modified);
      if (!Number.isNaN(date.getTime())) lastModified = date;
    }
    for (const entry of data) words.add(entry.word);
    if (!meta.next_cursor) {
      if (words.size === 0) throw new Error('the list is empty');
      return { words: [...words], lastModified, builtAt: deps.now() };
    }
    cursor = meta.next_cursor;
  }
  throw new Error(`the list did not end after ${MAX_PAGES} pages`);
};

export type HeadwordIndexHandleT = {
  /**
   * The current index, refreshing it in the background when it is stale.
   * Without one yet, waits up to `waitMs` for the running walk — a small
   * dictionary answers at once, the full one keeps the caller waiting no
   * longer than that and answers `null`
   */
  get: (options?: { waitMs?: number }) => Promise<HeadwordIndexT | null>;
  /** Forgets everything; the next `get` walks again (tests) */
  reset: () => void;
};

export const createHeadwordIndex = (deps: HeadwordIndexDepsT): HeadwordIndexHandleT => {
  let index: HeadwordIndexT | null = null;
  let refreshing: Promise<void> | null = null;
  let failedAt: number | null = null;

  const refresh = (): Promise<void> =>
    walkHeadwords(deps)
      .then((next) => {
        index = next;
        failedAt = null;
      })
      .catch((error: unknown) => {
        failedAt = deps.now();
        deps.warn(`headword index: the walk failed, ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        refreshing = null;
      });

  return {
    async get({ waitMs = 0 } = {}) {
      const now = deps.now();
      const stale = !index || now - index.builtAt > INDEX_TTL_MS;
      const backoff = failedAt !== null && now - failedAt < RETRY_AFTER_FAILURE_MS;
      if (stale && !refreshing && !backoff) refreshing = refresh();
      if (!index && refreshing && waitMs > 0) await Promise.race([refreshing, deps.sleep(waitMs)]);
      return index;
    },
    reset() {
      index = null;
      refreshing = null;
      failedAt = null;
    },
  };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // a pending wait must not keep the process alive
    timer.unref?.();
  });

/**
 * Where the process keeps its one index (issue #483). Next bundles a module
 * once per route that imports it — the browse page, the sitemap index and
 * the sitemap chunks each got an instance of this file, three indices and
 * three walks of the whole list. A module-level variable is per bundle;
 * `globalThis` is per process, like the store of cache-handler.js
 */
export const HEADWORD_INDEX_GLOBAL_KEY = Symbol.for('vocab-bloom-hub.site.headwordIndex');

type GlobalWithIndexT = typeof globalThis & { [HEADWORD_INDEX_GLOBAL_KEY]?: HeadwordIndexHandleT };

/** The index of this process, whichever route bundle asks */
export const headwordIndex: HeadwordIndexHandleT = ((globalThis as GlobalWithIndexT)[
  HEADWORD_INDEX_GLOBAL_KEY
] ??= createHeadwordIndex({
  // the site's own traffic, exempt from the public rate budget when INTERNAL_API_TOKEN is set
  fetch: (url) => nodeFetch(url, internalApiHeaders()),
  sleep,
  now: () => Date.now(),
  // eslint-disable-next-line no-console -- the site has no logger; the warning is for the operator
  warn: (message) => console.warn(message),
  apiBase: serverApiBase,
}));

/** How long a consumer waits for the first walk before answering "not yet" */
export const FIRST_WALK_WAIT_MS = 15_000;

/**
 * Headwords per word sitemap: every headword is eight URLs (one per
 * interface language) with nine hreflang links each, and a sitemap must stay
 * under 50 000 URLs and 50 MB
 */
export const HEADWORDS_PER_SITEMAP = 2500;

export const sitemapChunkCount = (index: HeadwordIndexT): number =>
  Math.ceil(index.words.length / HEADWORDS_PER_SITEMAP);

export const sitemapChunk = (index: HeadwordIndexT, chunk: number): string[] =>
  index.words.slice(chunk * HEADWORDS_PER_SITEMAP, (chunk + 1) * HEADWORDS_PER_SITEMAP);
