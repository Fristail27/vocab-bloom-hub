import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** How long a regenerated page (a word page, a browse page) is fresh, in seconds */
export const PAGE_REVALIDATE_SECONDS = 3600;
/** …and for how long after that a stale copy may still be served while it regenerates */
export const PAGE_STALE_SECONDS = 24 * 3600;

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
};

export default withNextIntl(nextConfig);
