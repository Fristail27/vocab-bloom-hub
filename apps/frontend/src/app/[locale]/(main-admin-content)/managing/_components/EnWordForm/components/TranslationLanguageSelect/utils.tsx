import { AvailableTranslationLanguagesE } from 'server/types';
import allIcons from '@/core/ui/icons';
import { TranslatorT } from '@/types/common';

type LanguagePresentationT = { icons: Array<keyof typeof allIcons>; labelKey: Parameters<TranslatorT>[0] };

// One entry per member of the enum (issue #394): adding a translation
// language fails to type-check until its flag and label are declared here
const TRANSLATION_LANGUAGE_PRESENTATION: Record<AvailableTranslationLanguagesE, LanguagePresentationT> = {
  [AvailableTranslationLanguagesE.ru]: { icons: ['rusFlag'], labelKey: 'translation_rus' },
  [AvailableTranslationLanguagesE.es]: { icons: ['esFlag'], labelKey: 'translation_es' },
};

export const getTranslationsOptions = (t: TranslatorT) =>
  Object.values(AvailableTranslationLanguagesE).map((value) => {
    const { icons, labelKey } = TRANSLATION_LANGUAGE_PRESENTATION[value];
    return { value, icons, label: t(labelKey) };
  });
