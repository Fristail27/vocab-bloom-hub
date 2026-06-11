import { EnEntry } from '../entities/en_entry.entity';
import { EnWordFormsE, EnWordT } from '../../../../types';
import { prepareWordForm } from './prepareWordForm';

export const mapSearchResults = (entries: EnEntry[]): EnWordT[] => {
  const r: EnWordT[] = [];
  const config: Record<string, true> = {};

  entries.forEach((entry) => {
    entry.entries.forEach((w) => {
      if (w.form_of_word == EnWordFormsE.base_form) {
        r.push({
          ...w,
          word: entry.word,
          forms: (w.forms || [])?.map(prepareWordForm),
          meanings: [],
          short_translations: [],
          base_phrasal: undefined,
          base_form: undefined,
        });
        config[w.id] = true;
      } else {
        if (!config[w.id] && w.base_form) {
          r.push({
            ...w.base_form,
            word: entry.word,
            forms: (w.base_form?.forms || [])?.map(prepareWordForm),
            meanings: [],
            short_translations: [],
            base_phrasal: undefined,
            base_form: undefined,
          });
          config[w.base_form.id] = true;
        }
      }
    });
  });

  return r;
};
