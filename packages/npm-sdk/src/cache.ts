/**
 * Conditional requests for GET answers: the public API sends an ETag with
 * every successful GET and answers `304 Not Modified` to a matching
 * `If-None-Match`. The cache keeps the last body per URL and hands it back
 * on a 304, so a repeated read costs a round trip without a payload.
 * In-memory, per client instance, bounded by `maxEntries` (oldest out).
 */
export type CacheEntryT = { etag: string; body: unknown };

export interface ResponseCache {
  get(url: string): CacheEntryT | undefined;
  set(url: string, entry: CacheEntryT): void;
}

export class MemoryCache implements ResponseCache {
  private readonly entries = new Map<string, CacheEntryT>();

  constructor(private readonly maxEntries = 500) {}

  get(url: string): CacheEntryT | undefined {
    const entry = this.entries.get(url);
    if (entry) {
      // refresh the insertion order: the least recently used goes first
      this.entries.delete(url);
      this.entries.set(url, entry);
    }
    return entry;
  }

  set(url: string, entry: CacheEntryT): void {
    this.entries.delete(url);
    this.entries.set(url, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
