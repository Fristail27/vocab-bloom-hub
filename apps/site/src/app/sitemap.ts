import type { MetadataRoute } from 'next';

import { DOC_PAGES } from '@/content/registry';
import { EXAMPLE_WORDS } from '@/content/words';
import { routing } from '@/i18n/routing';

/** The public origin of this site, for absolute URLs in the sitemap (NEXT_PUBLIC_SITE_URL) */
export const siteUrl = (): string =>
  (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3020').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = ['', '/docs', '/api', '/playground', '/word', ...DOC_PAGES.map((page) => `/docs/${page.slug}`)];
  const words = EXAMPLE_WORDS.map((word) => `/word/${encodeURIComponent(word)}`);

  return routing.locales.flatMap((locale) => [
    ...pages.map((path) => ({ url: `${base}/${locale}${path}`, changeFrequency: 'weekly' as const })),
    ...words.map((path) => ({ url: `${base}/${locale}${path}`, changeFrequency: 'monthly' as const })),
  ]);
}
