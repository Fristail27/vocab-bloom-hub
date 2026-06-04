import { AvailableTranslationLanguagesE } from 'server/types';
import { TranslatorT } from '@/types/common';

export const getTranslationsOptions = (t: TranslatorT) => [
  { value: AvailableTranslationLanguagesE.ru, icons: ['rusFlag' as const], label: t('translation_rus') },
];
