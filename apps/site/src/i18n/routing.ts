import { defineRouting } from 'next-intl/routing';

import { InterfaceLanguageEnum } from '@/types/common';

export const routing = defineRouting({
  locales: [InterfaceLanguageEnum.en, InterfaceLanguageEnum.ru],
  defaultLocale: InterfaceLanguageEnum.en,
});

export const isLocale = (value: string): value is InterfaceLanguageEnum =>
  (routing.locales as readonly string[]).includes(value);
