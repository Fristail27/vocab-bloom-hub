import {
  createHeadwordIndex,
  HEADWORD_INDEX_GLOBAL_KEY,
  HEADWORDS_PER_SITEMAP,
  HeadwordIndexDepsT,
  INDEX_TTL_MS,
  RETRY_AFTER_FAILURE_MS,
  sitemapChunk,
  sitemapChunkCount,
} from '../headwords';

// The headword index behind the word sitemaps and the browse pages (issues
// #479, #480): a rate-limit-aware walk of GET /api/v1/words that never
// keeps a failed, partial or empty enumeration

type PageT = { words: string[]; next: string | null };

const json = (body: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });

const listPage = (page: PageT, headers: Record<string, string> = {}): Response =>
  json(
    {
      data: page.words.map((word, id) => ({ word, id })),
      meta: { limit: 100, has_more: !!page.next, next_cursor: page.next },
    },
    { headers },
  );

// an API scripted as a queue of answers: readiness first, then the list pages
const api = (answers: Array<Response | (() => Response)>) => {
  const calls: string[] = [];
  const fetch = async (input: string): Promise<Response> => {
    calls.push(input.replace('http://api', ''));
    const next = answers.shift();
    if (!next) throw new Error(`unexpected request ${String(input)}`);
    return typeof next === 'function' ? next() : next;
  };
  return { fetch, calls };
};

const deps = (fetch: HeadwordIndexDepsT['fetch'], overrides: Partial<HeadwordIndexDepsT> = {}) => {
  let now = 1_000_000;
  const slept: number[] = [];
  const warnings: string[] = [];
  const built: HeadwordIndexDepsT = {
    fetch,
    // a sleep a thousand times faster than asked, so the waits keep their order
    sleep: (ms) =>
      new Promise((resolve) => {
        slept.push(ms);
        setTimeout(resolve, Math.ceil(ms / 1000));
      }),
    now: () => now,
    warn: (message) => warnings.push(message),
    apiBase: () => 'http://api',
    ...overrides,
  };
  return { built, slept, warnings, tick: (ms: number) => (now += ms) };
};

const ready = () => json({ status: 'ok' });
const notReady = () => json({ status: 'error', reason: 'importing' }, { status: 503 });

describe('the headword index', () => {
  it('walks every page, de-duplicates the headwords and keeps the dictionary date', async () => {
    const { fetch, calls } = api([
      ready(),
      listPage({ words: ['a', 'a', 'b'], next: 'c1' }, { 'last-modified': 'Tue, 01 Sep 2026 10:00:00 GMT' }),
      listPage({ words: ['c'], next: null }),
    ]);
    const { built } = deps(fetch);
    const index = createHeadwordIndex(built);

    const result = await index.get({ waitMs: 1000 });

    expect(result?.words).toEqual(['a', 'b', 'c']);
    expect(result?.lastModified?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect(calls).toEqual(['/ready', '/v1/words?limit=100', '/v1/words?limit=100&cursor=c1']);
  });

  it('waits for Retry-After on 429 and goes on from the same page', async () => {
    const { fetch, calls } = api([
      ready(),
      listPage({ words: ['a'], next: 'c1' }),
      json({ error: true }, { status: 429, headers: { 'retry-after': '7' } }),
      json({ error: true }, { status: 429 }),
      listPage({ words: ['b'], next: null }),
    ]);
    const { built, slept } = deps(fetch);

    // the caller waits longer than the two rate-limit pauses
    const result = await createHeadwordIndex(built).get({ waitMs: 200_000 });

    expect(result?.words).toEqual(['a', 'b']);
    expect(slept.filter((ms) => ms !== 200_000)).toEqual([7000, 60_000]);
    expect(calls.filter((call) => call.includes('cursor=c1'))).toHaveLength(3);
  });

  it('keeps nothing from an interrupted walk and retries only after the backoff', async () => {
    const { fetch, calls } = api([
      ready(),
      listPage({ words: ['a'], next: 'c1' }),
      json({ error: true }, { status: 500 }),
      // the second attempt
      ready(),
      listPage({ words: ['a', 'b'], next: null }),
    ]);
    const { built, warnings, tick } = deps(fetch);
    const index = createHeadwordIndex(built);

    expect(await index.get({ waitMs: 1000 })).toBeNull();
    expect(warnings).toEqual(['headword index: the walk failed, GET /v1/words answered 500']);
    // inside the backoff: no new walk
    tick(RETRY_AFTER_FAILURE_MS - 1);
    expect(await index.get({ waitMs: 1000 })).toBeNull();
    expect(calls).toHaveLength(3);
    tick(2);
    expect((await index.get({ waitMs: 1000 }))?.words).toEqual(['a', 'b']);
  });

  it('does not walk while the instance is not ready, and never keeps an empty list', async () => {
    const { fetch, calls } = api([notReady(), ready(), listPage({ words: [], next: null })]);
    const { built, warnings, tick } = deps(fetch);
    const index = createHeadwordIndex(built);

    expect(await index.get({ waitMs: 1000 })).toBeNull();
    expect(calls).toEqual(['/ready']);
    tick(RETRY_AFTER_FAILURE_MS + 1);
    expect(await index.get({ waitMs: 1000 })).toBeNull();
    expect(warnings).toEqual([
      'headword index: the walk failed, the instance is not ready (503)',
      'headword index: the walk failed, the list is empty',
    ]);
  });

  it('serves the stale index while a refresh runs in the background, and keeps it when the refresh fails', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetch } = api([
      ready(),
      listPage({ words: ['old'], next: null }),
      // the refresh: blocked until released, then fails
      () => {
        throw new Error('network down');
      },
    ]);
    const { built, tick } = deps(fetch, {
      sleep: async () => {
        await gate;
      },
    });
    const index = createHeadwordIndex(built);
    expect((await index.get({ waitMs: 1000 }))?.words).toEqual(['old']);

    tick(INDEX_TTL_MS + 1);
    // stale: answered at once from the old index while the walk starts
    expect((await index.get({ waitMs: 1000 }))?.words).toEqual(['old']);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    expect((await index.get())?.words).toEqual(['old']);
  });

  it('answers null at once when asked not to wait, then the index once the walk is done', async () => {
    const { fetch } = api([ready(), listPage({ words: ['a'], next: null })]);
    const { built } = deps(fetch);
    const index = createHeadwordIndex(built);

    expect(await index.get()).toBeNull();
    await new Promise((resolve) => setImmediate(resolve));
    expect((await index.get())?.words).toEqual(['a']);
  });
});

describe('the index of the process', () => {
  type SlotT = typeof globalThis & { [HEADWORD_INDEX_GLOBAL_KEY]?: unknown };
  const slot = globalThis as SlotT;

  afterEach(() => {
    delete slot[HEADWORD_INDEX_GLOBAL_KEY];
  });

  it('is one object however many bundles load the module (issue #483)', () => {
    // Next compiles the module once per route that imports it; each copy must find the same index
    const loaded: unknown[] = [];
    for (let i = 0; i < 2; i += 1) {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module instance per iteration
        loaded.push((require('../headwords') as { headwordIndex: unknown }).headwordIndex);
      });
    }
    expect(loaded[0]).toBe(loaded[1]);
    expect(slot[HEADWORD_INDEX_GLOBAL_KEY]).toBe(loaded[0]);
  });
});

describe('the sitemap chunks', () => {
  it('cut the index into files of HEADWORDS_PER_SITEMAP headwords', () => {
    const words = Array.from({ length: HEADWORDS_PER_SITEMAP * 2 + 1 }, (_, i) => `w${i}`);
    const index = { words, lastModified: null, builtAt: 0 };

    expect(sitemapChunkCount(index)).toBe(3);
    expect(sitemapChunk(index, 0)).toHaveLength(HEADWORDS_PER_SITEMAP);
    expect(sitemapChunk(index, 2)).toEqual([`w${HEADWORDS_PER_SITEMAP * 2}`]);
    expect(sitemapChunkCount({ ...index, words: [] })).toBe(0);
  });
});
