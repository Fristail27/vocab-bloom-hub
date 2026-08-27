import { describe, expect, it } from '@jest/globals';
import { CACHE_CONTROL_NO_STORE, publicCacheControl, weakEtagOf } from '../http-cache';

describe('public API caching helpers (issue #274)', () => {
  it('hashes equal bodies to the same weak tag and different bodies to different tags', () => {
    const tag = weakEtagOf('{"data":{"id":1}}');
    expect(tag).toMatch(/^W\/"[A-Za-z0-9_-]+"$/);
    expect(weakEtagOf('{"data":{"id":1}}')).toBe(tag);
    expect(weakEtagOf('{"data":{"id":2}}')).not.toBe(tag);
    expect(weakEtagOf('')).toMatch(/^W\/"[A-Za-z0-9_-]+"$/);
  });

  it('builds the Cache-Control of public reads from the max-age', () => {
    expect(publicCacheControl(3600)).toBe('public, max-age=3600');
    expect(publicCacheControl(1)).toBe('public, max-age=1');
    expect(publicCacheControl(0)).toBe('public, no-cache');
    expect(CACHE_CONTROL_NO_STORE).toBe('no-store');
  });
});
