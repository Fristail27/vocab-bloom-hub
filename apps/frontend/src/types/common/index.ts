import { useTranslations } from 'next-intl';

export enum ThemeE {
  light = 'light',
  dark = 'dark',
}

export enum InterfaceLanguageEnum {
  en = 'en',
  ru = 'ru',
}

export type CommonPageP = {
  params: Promise<{
    locale: InterfaceLanguageEnum;
  }>;
};

export type TranslatorT = ReturnType<typeof useTranslations>;
