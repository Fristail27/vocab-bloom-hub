import { defineRouting } from 'next-intl/routing';

import { InterfaceLanguageEnum } from '@/types/common';

export const routing = defineRouting({
  locales: Object.values(InterfaceLanguageEnum),
  defaultLocale: InterfaceLanguageEnum.en,
});
