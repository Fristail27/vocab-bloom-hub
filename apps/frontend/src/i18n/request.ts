import { getRequestConfig } from 'next-intl/server';

import { InterfaceLanguageEnum } from '@/types/common';

import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as InterfaceLanguageEnum)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
