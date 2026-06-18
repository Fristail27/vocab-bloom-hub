import { useTranslations } from 'next-intl';

export enum ThemeE {
  light = 'light',
  dark = 'dark',
}

export enum InterfaceLanguageEnum {
  en = 'en',
  ru = 'ru',
}

export type CommonPageP<T extends object = object> = {
  params: Promise<
    {
      locale: InterfaceLanguageEnum;
    } & T
  >;
};

export type TranslatorT = ReturnType<typeof useTranslations>;
