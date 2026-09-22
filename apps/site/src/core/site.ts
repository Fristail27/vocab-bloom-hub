import { version as packageVersion } from '../../package.json';

import type { Metadata } from 'next';

import { routing } from '@/i18n/routing';

/**
 * The public origin of this site, for absolute URLs in the sitemap, robots.txt
 * and the social cards (NEXT_PUBLIC_SITE_URL, inlined at build time)
 */
export const siteUrl = (): string =>
  (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3020').replace(/\/$/, '');

/** The name of the site: the brand in the social cards and the title template */
export const SITE_NAME = 'Vocab Bloom Hub';

/** The social card image every page shares, rendered per locale by [locale]/opengraph-image.tsx */
export const OG_IMAGE = { width: 1200, height: 630 } as const;

/** Search engines show about this many characters of a description; a longer one is cut mid-sentence */
export const DESCRIPTION_MAX_LENGTH = 160;

/**
 * A description that fits a search snippet (issue #480): cut at a word
 * boundary before `max` characters, with an ellipsis. Whitespace is collapsed
 * first — the Markdown paragraphs and the dictionary data both wrap
 */
export const trimDescription = (text: string, max = DESCRIPTION_MAX_LENGTH): string => {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  const head = compact.slice(0, max - 1);
  const boundary = head.lastIndexOf(' ');
  // no boundary in the first half: a run of characters, cut it hard
  const cut = boundary > max / 2 ? head.slice(0, boundary) : head;
  return `${cut.replace(/[\s,;:—–-]+$/, '')}…`;
};

export type PageMetaOptionsT = {
  locale: string;
  /**
   * The route without the locale prefix (`'/docs'`, `''` for the home page;
   * a query string is part of it): the canonical URL, `og:url` and the
   * hreflang links are built from it
   */
  path: string;
  title: string;
  /** Rendered as given, outside the layout's `%s · Vocab Bloom Hub` template (the home page) */
  absoluteTitle?: boolean;
  description?: string;
  /** `og:type`: `article` for a document (a docs page, a word page), `website` (the default) otherwise */
  type?: 'website' | 'article';
  /**
   * The locales the page really exists in: every interface language unless
   * told otherwise. A page rendered in a locale it has no translation for
   * (the English documentation under /de) is canonicalized to the English
   * URL and declares hreflang for the real translations only, so the eight
   * copies are not eight competing pages (issue #480)
   */
  locales?: readonly string[];
};

/**
 * Canonical + hreflang for one route (issue #350). Relative URLs — the
 * layout's `metadataBase` makes them absolute. `x-default` is the English
 * page, the one convention of the site: the next-intl middleware's `Link`
 * header (which said the unprefixed path) is off in i18n/routing.ts
 */
export const localeAlternates = (
  locale: string,
  path: string,
  locales: readonly string[] = routing.locales,
): Metadata['alternates'] => ({
  canonical: `/${locales.includes(locale) ? locale : routing.defaultLocale}${path}`,
  languages: {
    ...Object.fromEntries(
      routing.locales
        .filter((candidate) => locales.includes(candidate))
        .map((candidate) => [candidate, `/${candidate}${path}`]),
    ),
    'x-default': `/${routing.defaultLocale}${path}`,
  },
});

/**
 * The metadata of one page (issues #332, #480): the title and description,
 * the canonical / hreflang pair, and the whole social card. Next.js replaces
 * `openGraph` as a unit when a page defines it — the layout's `type`,
 * `siteName`, `locale` and the file-based image are dropped — so the card is
 * restated in full here, `og:url` included, and every page goes through
 * this one function
 */
export const pageMeta = ({
  locale,
  path,
  title,
  absoluteTitle = false,
  description,
  type = 'website',
  locales,
}: PageMetaOptionsT): Metadata => {
  const alternates = localeAlternates(locale, path, locales);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates,
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale,
      url: alternates?.canonical as string,
      title,
      description,
      images: [{ url: `/${locale}/opengraph-image`, ...OG_IMAGE, alt: SITE_NAME }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
};

/**
 * The webmaster-tools tokens of the site (issue #480): Google Search Console,
 * Bing Webmaster and Yandex Webmaster verify an origin by a `<meta>` on the
 * start page. Read like NEXT_PUBLIC_SITE_URL — at build time, the page that
 * carries them is prerendered — so under Docker they are build arguments
 * (docs/environment.md)
 */
export const siteVerification = (): Metadata['verification'] => {
  const google = process.env.SITE_VERIFICATION_GOOGLE?.trim();
  const yandex = process.env.SITE_VERIFICATION_YANDEX?.trim();
  const bing = process.env.SITE_VERIFICATION_BING?.trim();
  if (!google && !yandex && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    // Bing has no first-class field: its tag is <meta name="msvalidate.01">
    ...(bing ? { other: { 'msvalidate.01': [bing] } } : {}),
  };
};

/** The version of this build of the site — the monorepo version, bumped by scripts/bump-version.mjs */
export const SITE_VERSION: string = packageVersion;
