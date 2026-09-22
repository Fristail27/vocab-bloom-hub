import { siteUrl } from './site';
import { routing } from '@/i18n/routing';

// Sitemap XML by hand (issue #480): Next's `sitemap.ts` convention renders
// at build time or per request from one function, while the word sitemaps
// are cut from the headword index — a sitemap index plus one file per chunk,
// every URL with its hreflang set and the dictionary's modification date

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

/** The absolute URL of a route in a locale (`path` without the locale prefix) */
export const localeUrl = (locale: string, path: string): string => `${siteUrl()}/${locale}${path}`;

/**
 * One `<url>` per locale of a route, each declaring every locale as an
 * alternate and the English page as x-default — the same set the HTML
 * carries, the cheap way to declare 8 × N alternates to a crawler
 */
export const localizedUrls = (path: string, lastModified: Date | null): string => {
  const links = [
    ...routing.locales.map(
      (locale) =>
        `<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(localeUrl(locale, path))}"/>`,
    ),
    `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(localeUrl(routing.defaultLocale, path))}"/>`,
  ].join('');
  const lastmod = lastModified ? `<lastmod>${lastModified.toISOString()}</lastmod>` : '';
  return routing.locales
    .map((locale) => `<url><loc>${escapeXml(localeUrl(locale, path))}</loc>${links}${lastmod}</url>`)
    .join('');
};

/** A `<urlset>` of localized routes */
export const urlsetXml = (paths: readonly string[], lastModified: Date | null): string =>
  `${XML_HEAD}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${paths
    .map((path) => localizedUrls(path, lastModified))
    .join('')}</urlset>`;

/** A `<sitemapindex>` of absolute sitemap URLs */
export const sitemapIndexXml = (urls: readonly string[], lastModified: Date | null): string => {
  const lastmod = lastModified ? `<lastmod>${lastModified.toISOString()}</lastmod>` : '';
  return `${XML_HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
    .map((url) => `<sitemap><loc>${escapeXml(url)}</loc>${lastmod}</sitemap>`)
    .join('')}</sitemapindex>`;
};

const CACHE_SECONDS = 3600;
const RETRY_AFTER_SECONDS = 120;

/** No headword index yet: a crawler is told to come back, nothing is cached */
export const sitemapUnavailable = (): Response =>
  new Response('The word index is being built, try again later.', {
    status: 503,
    headers: { 'retry-after': String(RETRY_AFTER_SECONDS), 'cache-control': 'no-store' },
  });

/** A sitemap body; the index changes once a day, an hour of caching is plenty */
export const xmlResponse = (body: string): Response =>
  new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
