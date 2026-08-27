import { createHash } from 'node:crypto';

// Nothing outside the public read prefix may be stored by a cache: the admin
// answers carry editing state, the public errors are transient
export const CACHE_CONTROL_NO_STORE = 'no-store';

/**
 * Weak validator of a response body (issue #274): the same JSON always
 * hashes to the same tag, so a client's If-None-Match answers 304 until the
 * data behind the endpoint changes. Weak because the byte stream may still
 * differ (compression, key order of a future serializer) for equal content.
 */
export const weakEtagOf = (body: string): string =>
  `W/"${createHash('sha1').update(body, 'utf8').digest('base64url')}"`;

/**
 * The Cache-Control of a successful public GET: shared caches may keep it
 * for `maxAgeSeconds`; zero asks every cache to revalidate on each use,
 * which the ETag makes cheap (304, no body).
 */
export const publicCacheControl = (maxAgeSeconds: number): string =>
  maxAgeSeconds > 0 ? `public, max-age=${maxAgeSeconds}` : 'public, no-cache';
