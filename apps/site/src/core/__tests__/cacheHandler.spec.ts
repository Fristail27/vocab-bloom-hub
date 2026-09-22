import LruCacheHandler from '../../../cache-handler.js';

// The in-memory, size-bounded server cache of the site (issue #480)
describe('the LRU cache handler', () => {
  const page = (html: string) => ({
    kind: 'APP_PAGE',
    html,
    rscData: Buffer.from(html),
    headers: {},
    status: 200,
  });

  it('shares one store between instances: Next makes a handler per request', async () => {
    const store = LruCacheHandler.createStore(1000);
    await new LruCacheHandler({ store, disk: null }).set('a', page('<html>'));
    expect((await new LruCacheHandler({ store, disk: null }).get('a'))?.value).toEqual(page('<html>'));
    // and the default store is the process's
    await new LruCacheHandler({ disk: null }).set('shared', page('x'));
    expect(await new LruCacheHandler({ disk: null }).get('shared')).not.toBeNull();
  });

  it('stores and serves entries in the shape Next expects', async () => {
    const cache = new LruCacheHandler({ store: LruCacheHandler.createStore(1000), disk: null });
    await cache.set('a', page('<html>'), { tags: ['t1'] });

    const hit = await cache.get('a');
    expect(hit?.value).toEqual(page('<html>'));
    expect(hit?.tags).toEqual(['t1']);
    expect(typeof hit?.lastModified).toBe('number');
    expect(await cache.get('missing')).toBeNull();
  });

  it('evicts the least recently used entries once the size bound is reached', async () => {
    // an entry of a 20-character page is 56 bytes: two fit, three do not
    const cache = new LruCacheHandler({ store: LruCacheHandler.createStore(150), disk: null });
    await cache.set('a', page('a'.repeat(20)));
    await cache.set('b', page('b'.repeat(20)));
    // a is used again, so b is the oldest
    await cache.get('a');
    await cache.set('c', page('c'.repeat(20)));

    expect(await cache.get('b')).toBeNull();
    expect(await cache.get('a')).not.toBeNull();
    expect(await cache.get('c')).not.toBeNull();
    // an entry larger than the whole cache is not kept
    await cache.set('huge', page('x'.repeat(200)));
    expect(await cache.get('huge')).toBeNull();
  });

  it('drops the entries of a revalidated tag and replaces an entry under the same key', async () => {
    const cache = new LruCacheHandler({ store: LruCacheHandler.createStore(1000), disk: null });
    await cache.set('a', page('one'), { tags: ['words'] });
    await cache.set('b', page('two'), { tags: ['docs'] });
    await cache.set('a', page('three'), { tags: ['words'] });
    expect((await cache.get('a'))?.value).toEqual(page('three'));

    await cache.revalidateTag('words');
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).not.toBeNull();
    await cache.set('b', null);
    expect(await cache.get('b')).toBeNull();
  });

  it('reads a page missing in memory from the prerendered files, never a fetch entry', async () => {
    const reads: Array<[string, unknown]> = [];
    const disk = {
      get: async (key: string, ctx?: { kind?: string }) => {
        reads.push([key, ctx?.kind]);
        return { value: page('prerendered'), lastModified: 1, tags: [] };
      },
      revalidateTag: async () => undefined,
    };
    const cache = new LruCacheHandler({ store: LruCacheHandler.createStore(1000), disk });

    expect((await cache.get('/en/docs', { kind: 'APP_PAGE' }))?.value).toEqual(page('prerendered'));
    expect(await cache.get('abc123', { kind: 'FETCH' })).toBeNull();
    expect(reads).toEqual([['/en/docs', 'APP_PAGE']]);
    // memory first
    await cache.set('/en/docs', page('regenerated'));
    expect((await cache.get('/en/docs', { kind: 'APP_PAGE' }))?.value).toEqual(page('regenerated'));
    expect(reads).toHaveLength(1);
  });
});
