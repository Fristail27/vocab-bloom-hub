// the types of cache-handler.js, for its spec; Next loads the JavaScript by path
export type CacheEntryT = { value: unknown; lastModified: number; tags: string[] };
export type CacheStoreT = {
  maxBytes: number;
  entries: Map<string, { value: CacheEntryT; size: number }>;
  bytes: number;
};

export type CacheContextT = { kind?: string; tags?: string[] };
export type DiskCacheT = {
  get(key: string, ctx?: CacheContextT): Promise<CacheEntryT | null>;
  revalidateTag(tags: string | string[], durations?: unknown): Promise<void>;
};

declare class LruCacheHandler {
  constructor(options?: { store?: CacheStoreT; disk?: DiskCacheT | null; serverDistDir?: string });
  get(key: string, ctx?: CacheContextT): Promise<CacheEntryT | null>;
  set(key: string, data: unknown, ctx?: { tags?: string[] }): Promise<void>;
  revalidateTag(tags: string | string[], durations?: unknown): Promise<void>;
  resetRequestCache(): void;
  static createStore(maxBytes?: number): CacheStoreT;
}

export = LruCacheHandler;
