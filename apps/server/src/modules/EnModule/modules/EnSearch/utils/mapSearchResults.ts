import { EnWordFormsE, EnWordT } from '../../../../../../types';
import { prepareWordForm } from '../../../utils/prepareWordForm';
import { EnWord } from '../../../entities/en_word.entity';

export const mapSearchResults = (words: EnWord[]): EnWordT[] => {
  const r: EnWordT[] = [];
  const config: Record<string, true> = {};

  words.forEach((w) => {
    if (w.form_of_word == EnWordFormsE.base_form) {
      r.push({
        ...w,
        phrasal_variants: undefined,
        word: w.word.word,
        forms: (w.forms || [])?.map(prepareWordForm),
        meanings: [],
        short_translations: [],
        base_phrasal: w.base_phrasal?.word?.word,
        base_form: undefined,
      });
      config[w.id] = true;
    } else {
      if (!config[w.id] && w.base_form) {
        r.push({
          ...w.base_form,
          phrasal_variants: undefined,
          word: w.word.word,
          forms: (w.base_form?.forms || [])?.map(prepareWordForm),
          meanings: [],
          short_translations: [],
          base_phrasal: w.base_phrasal?.word?.word,
          base_form: undefined,
        });
        config[w.base_form.id] = true;
      }
    }
  });
  return r;
};
