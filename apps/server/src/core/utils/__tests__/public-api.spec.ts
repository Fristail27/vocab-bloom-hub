import { describe, expect, it } from '@jest/globals';
import {
  assertPublicApiConfig,
  DEFAULT_PUBLIC_API_CACHE_MAX_AGE,
  DEFAULT_PUBLIC_API_RATE_LIMIT,
  getApiSurfaces,
  getPublicApiCacheMaxAge,
  getPublicApiRateLimit,
  parsePublicApiCacheMaxAge,
  isAdminApiPath,
  isPublicApiPath,
  parsePublicApiRateLimit,
  requestPath,
} from '../public-api';
import { ConfigurationError } from '../../../../configuration';

describe('public API configuration (issue #271)', () => {
  it('parses PUBLIC_API_RATE_LIMIT as <requests>/<seconds> and defaults to 100/60', () => {
    expect(parsePublicApiRateLimit(undefined)).toEqual(DEFAULT_PUBLIC_API_RATE_LIMIT);
    expect(parsePublicApiRateLimit('  ')).toEqual({ limit: 100, ttl: 60_000 });
    expect(parsePublicApiRateLimit('1000/60')).toEqual({ limit: 1000, ttl: 60_000 });
    expect(parsePublicApiRateLimit('5/1')).toEqual({ limit: 5, ttl: 1000 });
    for (const bad of ['100', '100/0', '0/60', '100 per 60', '-1/60', 'abc']) {
      expect(() => parsePublicApiRateLimit(bad)).toThrow(ConfigurationError);
    }
    // the runtime reader never throws: startup validation already did
    expect(getPublicApiRateLimit({ PUBLIC_API_RATE_LIMIT: 'abc' })).toEqual(DEFAULT_PUBLIC_API_RATE_LIMIT);
    expect(getPublicApiRateLimit({ PUBLIC_API_RATE_LIMIT: '7/2' })).toEqual({ limit: 7, ttl: 2000 });
  });

  it('parses PUBLIC_API_CACHE_MAX_AGE as seconds and defaults to an hour (issue #274)', () => {
    expect(parsePublicApiCacheMaxAge(undefined)).toBe(DEFAULT_PUBLIC_API_CACHE_MAX_AGE);
    expect(parsePublicApiCacheMaxAge(' ')).toBe(3600);
    expect(parsePublicApiCacheMaxAge('0')).toBe(0);
    expect(parsePublicApiCacheMaxAge('86400')).toBe(86400);
    for (const bad of ['-1', '1h', '3600s', '1.5', 'abc']) {
      expect(() => parsePublicApiCacheMaxAge(bad)).toThrow(ConfigurationError);
    }
    expect(getPublicApiCacheMaxAge({ PUBLIC_API_CACHE_MAX_AGE: 'abc' })).toBe(DEFAULT_PUBLIC_API_CACHE_MAX_AGE);
    expect(getPublicApiCacheMaxAge({ PUBLIC_API_CACHE_MAX_AGE: '60' })).toBe(60);
    expect(() => assertPublicApiConfig({ PUBLIC_API_CACHE_MAX_AGE: '1h' })).toThrow(ConfigurationError);
  });

  it('reads the surface flags, both on by default, and rejects garbage', () => {
    expect(getApiSurfaces({})).toEqual({ publicApi: true, adminApi: true });
    expect(getApiSurfaces({ PUBLIC_API_ENABLED: 'false', ADMIN_API_ENABLED: 'TRUE' })).toEqual({
      publicApi: false,
      adminApi: true,
    });
    expect(getApiSurfaces({ PUBLIC_API_ENABLED: '1', ADMIN_API_ENABLED: 'off' })).toEqual({
      publicApi: true,
      adminApi: false,
    });
    expect(() => getApiSurfaces({ ADMIN_API_ENABLED: 'maybe' })).toThrow(ConfigurationError);
  });

  it('refuses an instance with both surfaces disabled', () => {
    expect(() => assertPublicApiConfig({})).not.toThrow();
    expect(() => assertPublicApiConfig({ PUBLIC_API_ENABLED: 'false' })).not.toThrow();
    expect(() => assertPublicApiConfig({ PUBLIC_API_ENABLED: 'false', ADMIN_API_ENABLED: 'false' })).toThrow(
      ConfigurationError,
    );
    expect(() => assertPublicApiConfig({ PUBLIC_API_RATE_LIMIT: 'lots' })).toThrow(ConfigurationError);
  });

  it('reads the path the client sent, not the one Express rewrote for a mounted middleware', () => {
    expect(requestPath({ originalUrl: '/api/v1/search?x=1', url: '/' })).toBe('/api/v1/search');
    expect(requestPath({ url: '/api/en/words?page=2' })).toBe('/api/en/words');
  });

  it('tells the public prefix from the admin prefixes by path', () => {
    expect(isPublicApiPath('/api/v1/search')).toBe(true);
    expect(isPublicApiPath('/api/v1')).toBe(true);
    expect(isPublicApiPath('/api/v10/search')).toBe(false);
    expect(isPublicApiPath('/api/en/search')).toBe(false);
    expect(isAdminApiPath('/api/en/search')).toBe(true);
    expect(isAdminApiPath('/api/settings/all')).toBe(true);
    expect(isAdminApiPath('/api/auth/login')).toBe(true);
    expect(isAdminApiPath('/api/entries')).toBe(false);
    expect(isAdminApiPath('/api/v1/search')).toBe(false);
    expect(isAdminApiPath('/api')).toBe(false);
  });
});
