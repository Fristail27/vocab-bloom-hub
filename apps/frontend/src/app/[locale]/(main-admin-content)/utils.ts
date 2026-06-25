import type { createTranslator, Messages } from 'use-intl/core';
import { InterfaceLanguageEnum } from '@/types/common';

export const getManagingButtons = (
  t: ReturnType<typeof createTranslator<Messages, 'managing'>>,
  locale: InterfaceLanguageEnum,
) => {
  return [
    { text: t('import_dictionary'), href: `/${locale}/managing/import-dictionary`, type: 'primary' as const },
    { text: t('add_word'), href: `/${locale}/managing/add-word`, type: 'primary' as const },
    { text: t('edit'), href: `/${locale}/managing`, type: 'dashed' as const },
  ];
};

export const getStatisticsButtons = (
  t: ReturnType<typeof createTranslator<Messages, 'statistics'>>,
  locale: InterfaceLanguageEnum,
) => {
  return [{ text: t('common_statistics'), href: `/${locale}/statistics/common`, type: 'primary' as const }];
};
