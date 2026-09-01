import type { Metadata } from 'next';

/**
 * The public origin of this site, for absolute URLs in the sitemap, robots.txt
 * and the social cards (NEXT_PUBLIC_SITE_URL, inlined at build time)
 */
export const siteUrl = (): string =>
  (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3020').replace(/\/$/, '');

/**
 * Page metadata with the title/description mirrored into the OpenGraph card
 * (issue #332): `openGraph` is replaced as a whole when a page defines it, so
 * every page that refines the title has to restate the card fields too.
 */
export const pageMeta = (title: string, description?: string): Metadata => ({
  title,
  description,
  openGraph: { title, description },
});

/**
 * Canonical + hreflang for one route (issue #350): `path` is the route
 * without the locale prefix (`'/docs'`, `''` for the home page). Relative
 * URLs — the layout's `metadataBase` makes them absolute.
 */
export const localeAlternates = (locale: string, path: string): Metadata['alternates'] => ({
  canonical: `/${locale}${path}`,
  languages: { en: `/en${path}`, ru: `/ru${path}`, 'x-default': `/en${path}` },
});
