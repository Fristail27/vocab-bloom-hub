import {defineRouting} from 'next-intl/routing';
import {InterfaceLanguageEnum} from '@/types/common';

export const routing = defineRouting({
    locales: [InterfaceLanguageEnum.en, InterfaceLanguageEnum.ru],
    defaultLocale: InterfaceLanguageEnum.en,
});