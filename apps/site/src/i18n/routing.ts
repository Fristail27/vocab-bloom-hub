import { defineRouting } from 'next-intl/routing';

import { InterfaceLanguageEnum } from '@/types/common';

export const routing = defineRouting({
  locales: Object.values(InterfaceLanguageEnum),
  defaultLocale: InterfaceLanguageEnum.en,
  // The hreflang set lives in the HTML of every page and in the sitemaps
  // (core/site.ts); the middleware's `Link` header declared the same
  // alternates with a different x-default (the unprefixed path, a 307), and
  // one convention beats two (issue #480)
  alternateLinks: false,
});

export const isLocale = (value: string): value is InterfaceLanguageEnum =>
  (routing.locales as readonly string[]).includes(value);
