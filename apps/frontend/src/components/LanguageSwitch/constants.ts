import { InterfaceLanguageEnum } from '@/types/common';

export const InterfaceLanguageOptions = [
  { value: InterfaceLanguageEnum.en, label: 'English', icons: ['usaFlag' as const] },
  { value: InterfaceLanguageEnum.ru, label: 'Русский', icons: ['rusFlag' as const] },
  { value: InterfaceLanguageEnum.es, label: 'Español', icons: ['esFlag' as const] },
  { value: InterfaceLanguageEnum.fr, label: 'Français', icons: ['frFlag' as const] },
  { value: InterfaceLanguageEnum.pt, label: 'Português', icons: ['ptFlag' as const] },
  { value: InterfaceLanguageEnum.de, label: 'Deutsch', icons: ['deFlag' as const] },
];
