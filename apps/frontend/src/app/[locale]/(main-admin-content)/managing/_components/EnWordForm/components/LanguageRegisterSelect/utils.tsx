import { LanguageRegisterE } from 'server/types';
import { TranslatorT } from '@/types/common';

export const getLanguageRegisterOptions = (t: TranslatorT) => [
  { value: LanguageRegisterE.formal, label: t('register_formal') },
  { value: LanguageRegisterE.informal, label: t('register_informal') },
  { value: LanguageRegisterE.slang, label: t('register_slang') },
];
