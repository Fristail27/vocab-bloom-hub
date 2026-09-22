'use strict';

/**
 * The server cache of the site (issue #480): the regenerated pages (the word
 * and browse pages are rendered on demand and kept for an hour, ISR) and the
 * fetch data cache, in memory, bounded by size — the least recently used
 * entries go first. Next's default handler writes every regenerated page to
 * disk under .next: the dictionary has ~115k headwords in eight languages,
 * and a crawler would grow that without bound. Plain CommonJS: Next loads it
 * by path at runtime (next.config.ts), outside the bundle, and instantiates
 * it per request — the store lives in the module.
 *
 * The pages prerendered at build time (the docs, the landing, …) are files
 * under .next/server that only Next's own file-system cache knows how to
 * read: a miss in memory is looked up there, and nothing is ever written
 * back to disk.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose: Next loads the file, not the bundler
const FileSystemCache = require('next/dist/server/lib/incremental-cache/file-system-cache').default;

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

// the bytes an entry holds: its strings and buffers (the HTML, the RSC
// payload, a fetched body), not a serialization of the whole object
const sizeOf = (value, depth = 0) => {
  if (typeof value === 'string') return value.length;
  if (Buffer.isBuffer(value)) return value.length;
  if (depth > 6 || value === null || typeof value !== 'object') return 8;
  let size = 0;
  for (const item of Array.isArray(value) ? value : Object.values(value)) size += sizeOf(item, depth + 1);
  return size;
};

/** One bounded LRU store; the process has one, a test makes its own */
const createStore = (maxBytes = Number(process.env.SITE_CACHE_MAX_BYTES) || DEFAULT_MAX_BYTES) => ({
  maxBytes,
  entries: new Map(),
  bytes: 0,
});

const processStore = createStore();

class LruCacheHandler {
  /** `options` is what Next passes (fs, serverDistDir, …); a test passes its own store and disk */
  constructor(options = {}) {
    this.store = options.store || processStore;
    this.disk =
      options.disk !== undefined
        ? options.disk
        : options.serverDistDir
          ? new FileSystemCache({ ...options, flushToDisk: false, maxMemoryCacheSize: 0 })
          : null;
  }

  async get(key, ctx) {
    const { entries } = this.store;
    const entry = entries.get(key);
    if (entry) {
      // a hit is the most recent entry again
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    }
    // the prerendered pages and routes live on disk; the fetch cache does not (it is never flushed)
    if (this.disk && ctx && ctx.kind !== 'FETCH') return this.disk.get(key, ctx);
    return null;
  }

  async set(key, data, ctx) {
    const store = this.store;
    this.remove(key);
    if (data === null || data === undefined) return;
    const size = sizeOf(data);
    if (size > store.maxBytes) return;
    const tags = (ctx && ctx.tags) || [];
    store.entries.set(key, { value: { value: data, lastModified: Date.now(), tags }, size });
    store.bytes += size;
    while (store.bytes > store.maxBytes) {
      const oldest = store.entries.keys().next().value;
      this.remove(oldest);
    }
  }

  async revalidateTag(tags, durations) {
    const wanted = new Set([].concat(tags));
    for (const [key, entry] of this.store.entries) {
      if (entry.value.tags.some((tag) => wanted.has(tag))) this.remove(key);
    }
    if (this.disk) await this.disk.revalidateTag(tags, durations);
  }

  resetRequestCache() {}

  remove(key) {
    const { entries } = this.store;
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    this.store.bytes -= entry.size;
  }
}

module.exports = LruCacheHandler;
module.exports.createStore = createStore;
