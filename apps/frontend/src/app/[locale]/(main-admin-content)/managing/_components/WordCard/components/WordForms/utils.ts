import { EnWordFormsE, EnWordFormT } from 'server/dist/types';

export const getCurrentForms = (form: EnWordFormsE, forms: EnWordFormT[]) => {
  return forms.filter((f) => f.form_of_word === form);
};
