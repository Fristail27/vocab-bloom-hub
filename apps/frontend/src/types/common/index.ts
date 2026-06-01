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
