export enum InterfaceLanguageEnum {
  en = 'en',
  ru = 'ru',
}

export type LocaleParamsP<T extends object = object> = {
  params: Promise<{ locale: InterfaceLanguageEnum } & T>;
};
