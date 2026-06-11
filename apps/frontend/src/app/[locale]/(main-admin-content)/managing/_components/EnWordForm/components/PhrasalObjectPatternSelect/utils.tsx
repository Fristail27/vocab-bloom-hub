import { EnPhrasalObjectPatternE } from 'server/types';
import { TranslatorT } from '@/types/common';

export const getPhrasalObjectPatternOptions = (t: TranslatorT) => [
  { value: EnPhrasalObjectPatternE.no_object, label: t('po_no_object') },
  { value: EnPhrasalObjectPatternE.inseparable, label: t('po_inseparable') },
  { value: EnPhrasalObjectPatternE.separable, label: t('po_separable') },
  { value: EnPhrasalObjectPatternE.separable_pronoun_only, label: t('po_separable_pronoun_only') },
];
