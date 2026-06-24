import { EnWordT } from 'server/types';
import { CommonInfoDataT } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/types';

export const getDefaultValue = (
  word: EnWordT,
): Omit<CommonInfoDataT, 'id' | 'form_of_word' | 'base_phrasal'> => {
  const {
    word: _word,
    part_of_speech: _part_of_speech,
    id: _id,
    forms: _forms,
    form_of_word: _form_of_word,
    base_form: _base_form,
    base_phrasal: _base_phrasal,
    meanings: _meanings,
    short_translations: _short_translations,
    phrasal_variants: _phrasal_variants,
    ...common
  } = word;

  return common;
};
