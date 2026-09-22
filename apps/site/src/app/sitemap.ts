import type { MetadataRoute } from 'next';

import { PUBLIC_SPEC_FILE } from '@/content/openapi';
import { DOC_PAGES, docFile, docLocales } from '@/content/registry';
import { repoFileDate } from '@/content/repo';
import { siteUrl } from '@/core/site';
import { routing } from '@/i18n/routing';
import { InterfaceLanguageEnum } from '@/types/common';

// The static pages of the site, rendered at build time (issue #480): every
// URL with its hreflang set — the same alternates the HTML declares — and,
// for the pages rendered from a repository file, the file's date. The word
// pages have a sitemap index of their own (sitemap-words.xml)
type EntryT = {
  path: string;
  locales: readonly InterfaceLanguageEnum[];
  lastModified?: (locale: InterfaceLanguageEnum) => Date;
};

const languages = (path: string, locales: readonly string[]): Record<string, string> => ({
  ...Object.fromEntries(locales.map((locale) => [locale, `${siteUrl()}/${locale}${path}`])),
  'x-default': `${siteUrl()}/${routing.defaultLocale}${path}`,
});

export default function sitemap(): MetadataRoute.Sitemap {
  const specDate = repoFileDate(PUBLIC_SPEC_FILE);
  const entries: EntryT[] = [
    { path: '', locales: routing.locales },
    { path: '/docs', locales: routing.locales },
    { path: '/api', locales: routing.locales, lastModified: () => specDate },
    { path: '/playground', locales: routing.locales, lastModified: () => specDate },
    { path: '/word', locales: routing.locales },
    // a docs page only in the locales it is translated into, dated by the file each locale renders
    ...DOC_PAGES.map((page) => ({
      path: `/docs/${page.slug}`,
      locales: docLocales(page),
      lastModified: (locale: InterfaceLanguageEnum) => repoFileDate(docFile(page, locale)),
    })),
  ];

  return entries.flatMap(({ path, locales, lastModified }) =>
    locales.map((locale) => ({
      url: `${siteUrl()}/${locale}${path}`,
      changeFrequency: 'weekly' as const,
      lastModified: lastModified?.(locale),
      alternates: { languages: languages(path, locales) },
    })),
  );
}
