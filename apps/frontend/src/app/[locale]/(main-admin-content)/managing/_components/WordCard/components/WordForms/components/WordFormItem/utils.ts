import { EnAreaVariantsE, EnWordFormsE, EnWordFormT } from 'server/types';

export const getDefaultNewFormData = (formOfWord: EnWordFormsE): EnWordFormT => ({
  id: 0,
  area_variant: EnAreaVariantsE.common,
  word: '',
  form_of_word: formOfWord,
  transcription: '',
});
