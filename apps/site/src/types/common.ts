// The interface locales of the app (issue #450 added es, fr, pt, de; #463 zh): a
// message catalog per member in ../messages, the parity spec keeps them in step
export enum InterfaceLanguageEnum {
  en = 'en',
  ru = 'ru',
  es = 'es',
  fr = 'fr',
  pt = 'pt',
  de = 'de',
  zh = 'zh',
}

export type LocaleParamsP<T extends object = object> = {
  params: Promise<{ locale: InterfaceLanguageEnum } & T>;
};
