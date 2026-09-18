import { InterfaceLanguageEnum } from '@/types/common';

// The interface locales written right-to-left (issue #464): the layout sets
// `dir` on <html> and Ant Design's ConfigProvider gets the same direction
export const RTL_LOCALES: ReadonlySet<InterfaceLanguageEnum> = new Set([InterfaceLanguageEnum.ar]);

export type DirectionT = 'ltr' | 'rtl';

export const localeDirection = (locale: string): DirectionT =>
  RTL_LOCALES.has(locale as InterfaceLanguageEnum) ? 'rtl' : 'ltr';
