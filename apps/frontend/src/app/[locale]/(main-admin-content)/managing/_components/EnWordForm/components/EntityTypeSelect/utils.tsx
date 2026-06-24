import { EnEntryTypesE } from 'server/types';
import { TranslatorT } from '@/types/common';

export const getEntityTypeOptions = (t: TranslatorT) => [
  { value: EnEntryTypesE.word, label: t(`entry_type_word`) },
  { value: EnEntryTypesE.phrase, label: t(`entry_type_phrase`) },
  { value: EnEntryTypesE.grammar_pattern, label: t(`entry_type_grammar_pattern`) },
];
