import {
  MemoryCache,
  NetworkError,
  NotFoundError,
  RateLimitError,
  SDK_VERSION,
  USER_AGENT,
  VocabBloomClient,
  VocabBloomError,
} from '../src';
import pkg from '../package.json';

type CallT = { url: string; init: RequestInit };

// A fetch that records calls and answers from a queue (no server involved)
const fakeFetch = (answers: Array<() => Response | Promise<Response>>) => {
  const calls: CallT[] = [];
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = answers.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return Promise.resolve(next());
  };
  return { fetch, calls };
};
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

describe('VocabBloomClient without a server (issue #275)', () => {
  it('builds the URL under /api/v1 and sends list filters as repeated keys', async () => {
    const { fetch, calls } = fakeFetch([
      () => json({ data: [], meta: { limit: 20, has_more: false, next_cursor: null } }),
    ]);
    const client = new VocabBloomClient({ baseUrl: 'https://dict.example.com/', fetch });
    await client.words({ part_of_speech: ['noun', 'verb'], with_meanings: true, limit: 5, cursor: undefined });
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe('https://dict.example.com/api/v1/words');
    expect(url.searchParams.getAll('part_of_speech')).toEqual(['noun', 'verb']);
    expect(url.searchParams.get('with_meanings')).toBe('true');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.has('cursor')).toBe(false);
    expect((calls[0].init.headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('encodes headwords with spaces and sends the search as a GET with the fields in the query (issue #396)', async () => {
    const { fetch, calls } = fakeFetch([
      () => json({ data: [], meta: { word: 'put up with', count: 0 } }),
      () => json({ data: [], meta: { count: 0, fuzzy: false, short_term: false } }),
      () => json({ data: [], meta: { page: 1, limit: 10, has_more: false, fuzzy: false, short_term: false } }),
    ]);
    const client = new VocabBloomClient({
      baseUrl: 'http://localhost:3010',
      fetch,
      headers: { 'X-App': 'test' },
    });
    await client.word('put up with');
    expect(calls[0].url).toBe('http://localhost:3010/api/v1/words/put%20up%20with');
    await client.search({ search: 'run', limit: 3 });
    expect(calls[1].init.method).toBe('GET');
    expect(calls[1].url).toBe('http://localhost:3010/api/v1/search?search=run&limit=3');
    expect(calls[1].init.body).toBeUndefined();
    expect(calls[1].init.headers).toMatchObject({ 'X-App': 'test' });
    await client.searchDetailed({ search: 'run', with_meanings: true, translation_languages: ['ru'] });
    const url = new URL(calls[2].url);
    expect(url.pathname).toBe('/api/v1/search/detailed');
    expect(url.searchParams.get('with_meanings')).toBe('true');
    expect(url.searchParams.getAll('translation_languages')).toEqual(['ru']);
  });

  it('posts a batch lookup as { words } (issue #397)', async () => {
    const { fetch, calls } = fakeFetch([
      () => json({ data: [], meta: { count: 0, not_found: ['run', 'ran'] } }),
    ]);
    const client = new VocabBloomClient({ baseUrl: 'http://localhost:3010', fetch });
    const batch = await client.wordsBatch(['run', 'ran']);
    expect(calls[0].url).toBe('http://localhost:3010/api/v1/words/batch');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBe(JSON.stringify({ words: ['run', 'ran'] }));
    expect(batch.meta.not_found).toEqual(['run', 'ran']);
  });

  it('throws typed errors: NotFoundError, RateLimitError with Retry-After, VocabBloomError with the API code', async () => {
    const { fetch } = fakeFetch([
      () => json({ statusCode: 404, message: 'word_doesnt_found', error: true }, { status: 404 }),
      () =>
        json(
          { statusCode: 429, message: 'too_many_requests', error: true },
          { status: 429, headers: { 'retry-after': '42' } },
        ),
      () => json({ statusCode: 400, message: 'invalid_cursor', error: true }, { status: 400 }),
      () => new Response('<html>bad gateway</html>', { status: 502 }),
    ]);
    const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch });

    const notFound = await client.word('nope').catch((e: unknown) => e);
    expect(notFound).toBeInstanceOf(NotFoundError);
    expect(notFound).toMatchObject({ status: 404, code: 'word_doesnt_found' });

    const limited = await client.meta().catch((e: unknown) => e);
    expect(limited).toBeInstanceOf(RateLimitError);
    expect(limited).toMatchObject({ status: 429, code: 'too_many_requests', retryAfter: 42 });

    const bad = await client.words({ cursor: 'x' }).catch((e: unknown) => e);
    expect(bad).toBeInstanceOf(VocabBloomError);
    expect(bad).toMatchObject({ status: 400, code: 'invalid_cursor', body: { message: 'invalid_cursor' } });

    const proxy = await client.meta().catch((e: unknown) => e);
    expect(proxy).toMatchObject({ status: 502, code: 'http_error', body: undefined });
  });

  it('wraps a failed fetch into NetworkError with the cause', async () => {
    const client = new VocabBloomClient({
      baseUrl: 'http://localhost',
      fetch: () => Promise.reject(new Error('ECONNREFUSED')),
    });
    const error = await client.meta().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ status: 0, code: 'network_error' });
    expect((error as Error).cause).toMatchObject({ message: 'ECONNREFUSED' });
  });

  it('revalidates GETs with If-None-Match when the cache is on and answers 304 from it', async () => {
    const body = { data: { api_version: '1' } };
    const { fetch, calls } = fakeFetch([
      () => json(body, { headers: { etag: 'W/"abc"' } }),
      () => new Response(null, { status: 304 }),
      () => json({ data: { api_version: '2' } }, { headers: { etag: 'W/"def"' } }),
    ]);
    const cache = new MemoryCache(10);
    const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch, cache });
    expect(await client.meta()).toEqual(body);
    expect(await client.meta()).toEqual(body);
    expect((calls[1].init.headers as Record<string, string>)['If-None-Match']).toBe('W/"abc"');
    expect(cache.size).toBe(1);
    // a changed answer replaces the entry
    expect(await client.meta()).toEqual({ data: { api_version: '2' } });
    expect(cache.get(calls[2].url)?.etag).toBe('W/"def"');
  });

  it('walks every page of the list through the cursor', async () => {
    const page = (ids: number[], next_cursor: string | null) =>
      json({
        data: ids.map((id) => ({ id, word: `w${id}` })),
        meta: { limit: 2, has_more: next_cursor !== null, next_cursor },
      });
    const { fetch, calls } = fakeFetch([
      () => page([1, 2], 'c1'),
      () => page([3, 4], 'c2'),
      () => page([5], null),
    ]);
    const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch });
    const ids: number[] = [];
    for await (const word of client.iterateWords({ limit: 2, word_level: ['A1'] })) ids.push(word.id);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
    expect(calls.map((c) => new URL(c.url).searchParams.get('cursor'))).toEqual([null, 'c1', 'c2']);
    expect(calls.every((c) => new URL(c.url).searchParams.get('word_level') === 'A1')).toBe(true);
  });

  // a fetch that never answers on its own and rejects when its signal aborts,
  // the way undici does — the only path a timeout can take
  const hangingFetch = () => {
    const signals: Array<AbortSignal | undefined> = [];
    const fetch = (_url: string, init: RequestInit) => {
      const signal = init.signal ?? undefined;
      signals.push(signal);
      return new Promise<Response>((_, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    };
    return { fetch, signals };
  };

  it('fails a hung request with NetworkError after timeoutMs (issue #352)', async () => {
    const { fetch } = hangingFetch();
    const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch });
    await expect(client.word('run', { timeoutMs: 25 })).rejects.toThrow(/timed out after 25 ms/);
    await expect(client.search({ search: 'run' }, { timeoutMs: 25 })).rejects.toThrow(NetworkError);
  });

  it('arms the default timeout, and timeoutMs: null disables it', async () => {
    const { fetch, signals } = hangingFetch();
    const withDefault = new VocabBloomClient({ baseUrl: 'http://localhost', fetch });
    void withDefault.word('run').catch(() => undefined);
    expect(signals[0]).toBeInstanceOf(AbortSignal);

    const disabled = new VocabBloomClient({ baseUrl: 'http://localhost', fetch, timeoutMs: null });
    void disabled.word('run').catch(() => undefined);
    expect(signals[1]).toBeUndefined();
  });

  it('keeps the caller signal working alongside the timeout', async () => {
    const { fetch } = hangingFetch();
    const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch });
    const controller = new AbortController();
    const pending = client.word('run', { signal: controller.signal, timeoutMs: 10_000 });
    controller.abort(new Error('caller aborted'));
    await expect(pending).rejects.toThrow(/caller aborted/);
  });

  it('identifies itself with a versioned User-Agent the caller may override (issue #408)', async () => {
    expect(SDK_VERSION).toBe(pkg.version);
    expect(USER_AGENT).toBe(`vocab-bloom-hub-npm/${pkg.version}`);
    const { fetch, calls } = fakeFetch([() => json({ data: {} }), () => json({ data: {} })]);
    await new VocabBloomClient({ baseUrl: 'http://localhost', fetch }).meta();
    expect((calls[0].init.headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT);
    await new VocabBloomClient({
      baseUrl: 'http://localhost',
      fetch,
      headers: { 'User-Agent': 'my-app/1' },
    }).meta();
    expect((calls[1].init.headers as Record<string, string>)['User-Agent']).toBe('my-app/1');
  });

  describe('opt-in retry (issue #408)', () => {
    const limited = (retryAfter?: string) =>
      json(
        { statusCode: 429, message: 'too_many_requests', error: true },
        { status: 429, headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter } },
      );
    const failing = () => json({ statusCode: 503, message: 'unavailable', error: true }, { status: 503 });

    it('is off by default: a 429 throws at once', async () => {
      const { fetch, calls } = fakeFetch([() => limited('0')]);
      const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch });
      await expect(client.meta()).rejects.toBeInstanceOf(RateLimitError);
      expect(calls).toHaveLength(1);
    });

    it('retries a GET after Retry-After, then after the backoff, until an answer', async () => {
      const { fetch, calls } = fakeFetch([
        () => limited('0'),
        () => failing(),
        () => json({ data: { ok: true } }),
      ]);
      const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch, retry: { backoffMs: 1 } });
      expect(await client.meta()).toEqual({ data: { ok: true } });
      expect(calls).toHaveLength(3);
    });

    it('gives up after `attempts` tries with the last error', async () => {
      const { fetch, calls } = fakeFetch([() => failing(), () => failing(), () => failing()]);
      const client = new VocabBloomClient({
        baseUrl: 'http://localhost',
        fetch,
        retry: { attempts: 2, backoffMs: 1 },
      });
      await expect(client.meta()).rejects.toMatchObject({ status: 503 });
      expect(calls).toHaveLength(2);
    });

    it('never retries a POST or a 4xx', async () => {
      const { fetch, calls } = fakeFetch([
        () => limited('0'),
        () => json({ statusCode: 404, message: 'word_doesnt_found', error: true }, { status: 404 }),
      ]);
      const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch, retry: { backoffMs: 1 } });
      await expect(client.wordsBatch(['run'])).rejects.toBeInstanceOf(RateLimitError);
      await expect(client.word('nope')).rejects.toBeInstanceOf(NotFoundError);
      expect(calls).toHaveLength(2);
    });

    it('caps a huge Retry-After at maxDelayMs', async () => {
      const { fetch, calls } = fakeFetch([() => limited('86400'), () => json({ data: {} })]);
      const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch, retry: { maxDelayMs: 1 } });
      const started = Date.now();
      await client.meta();
      expect(calls).toHaveLength(2);
      expect(Date.now() - started).toBeLessThan(1000);
    });

    it('stops waiting when the caller aborts', async () => {
      const { fetch, calls } = fakeFetch([() => limited('30')]);
      const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch, retry: {} });
      const controller = new AbortController();
      const pending = client.meta({ signal: controller.signal });
      controller.abort();
      await expect(pending).rejects.toBeInstanceOf(NetworkError);
      expect(calls).toHaveLength(1);
    });
  });

  it('ends the detailed-search iterator at the page cap instead of asking for page 21', async () => {
    let served = 0;
    const { fetch, calls } = fakeFetch(
      Array.from({ length: 25 }, () => () => {
        served += 1;
        return json({
          data: [{ id: served, word: `w${served}` }],
          meta: { page: served, limit: 1, has_more: true, fuzzy: false, short_term: false },
        });
      }),
    );
    const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch });
    const seen: number[] = [];
    for await (const word of client.iterateSearchDetailed({ search: 'w', limit: 1 })) seen.push(word.id);
    expect(seen).toHaveLength(20);
    expect(calls).toHaveLength(20);
  });

  it('walks every page of the detailed search through has_more (issue #408)', async () => {
    const page = (ids: number[], has_more: boolean, pageNo: number) =>
      json({
        data: ids.map((id) => ({ id, word: `w${id}` })),
        meta: { page: pageNo, limit: 2, has_more, fuzzy: false, short_term: false },
      });
    const { fetch, calls } = fakeFetch([() => page([1, 2], true, 1), () => page([3], false, 2)]);
    const client = new VocabBloomClient({ baseUrl: 'http://localhost', fetch });
    const seen: number[] = [];
    for await (const word of client.iterateSearchDetailed({ search: 'w', limit: 2 })) seen.push(word.id);
    expect(seen).toEqual([1, 2, 3]);
    expect(calls.map((c) => new URL(c.url).searchParams.get('page'))).toEqual(['1', '2']);
  });

  it('evicts the least recently used entry beyond maxEntries', () => {
    const cache = new MemoryCache(2);
    cache.set('a', { etag: '1', body: 1 });
    cache.set('b', { etag: '2', body: 2 });
    cache.get('a');
    cache.set('c', { etag: '3', body: 3 });
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')?.body).toBe(1);
    expect(cache.size).toBe(2);
  });
});
