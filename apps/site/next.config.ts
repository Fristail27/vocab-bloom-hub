import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** How long a regenerated page (a word page, a browse page) is fresh, in seconds */
export const PAGE_REVALIDATE_SECONDS = 3600;
/** …and for how long after that a stale copy may still be served while it regenerates */
export const PAGE_STALE_SECONDS = 24 * 3600;

// The security headers of the website (issue #479), set by the app so every
// installation has them with or without a reverse proxy. The pages may be
// framed by the site itself only. HSTS belongs to the TLS terminator
// (docs/deployment/reverse-proxy.md)
export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  // A self-contained build for the Docker image, like the admin UI (issue
  // #316): .next/standalone holds server.js and the node_modules it needs,
  // traced from the monorepo root
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // The word and browse pages are regenerated on demand (ISR, issue #480):
  // rendered once from the API, kept for an hour, then regenerated in the
  // background while the stale copy is served — and announced as such to a
  // CDN or the reverse proxy: `Cache-Control: s-maxage=3600,
  // stale-while-revalidate=86400`. A render the API failed is never kept.
  // The regenerated pages live in memory, size-bounded (cache-handler.js),
  // not on disk: the dictionary is 115k headwords in eight languages
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0,
  expireTime: PAGE_REVALIDATE_SECONDS + PAGE_STALE_SECONDS,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
