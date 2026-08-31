import { EnWord } from '../entities/en_word.entity';
import { EnWordT } from '../../../../types';
import { prepareWordForm } from './prepareWordForm';
import { prepareMeaningFromDB } from './prepareMeaningFromDB';
import { prepareShortTranslationFromDB } from './prepareTranslationsFromDB';

export const prepareWordFromDB = (row: EnWord): EnWordT => {
  const { createdAt: _createdAt, updateAt: _updateAt, short_translations, ...other } = row;
  return {
    ...other,
    word: row.word.word,
    user_modified: row.word.user_modified ?? false,
    forms: (row.forms || [])?.map(prepareWordForm),
    meanings: (row.meanings || []).map(prepareMeaningFromDB),
    short_translations: (short_translations || []).map(prepareShortTranslationFromDB),
    phrasal_variants: row.phrasal_variants?.map((w) => w.word.word),
    base_form: undefined,
    base_phrasal: row.base_phrasal?.word?.word,
  };
};
