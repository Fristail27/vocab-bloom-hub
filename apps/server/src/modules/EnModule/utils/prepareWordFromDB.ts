import { EnWord } from '../entities/en_word.entity';
import { EnWordT } from '../../../../types';
import { prepareWordForm } from './prepareWordForm';
import { prepareMeaningFromDB } from './prepareMeaningFromDB';

export const prepareWordFromDB = (row: EnWord): EnWordT => {
  const { createdAt: _createdAt, updateAt: _updateAt, ...other } = row;
  return {
    ...other,
    word: row.word.word,
    forms: (row.forms || [])?.map(prepareWordForm),
    meanings: (row.meanings || []).map(prepareMeaningFromDB),
    phrasal_variants: row.phrasal_variants?.map((w) => w.word.word),
    base_form: undefined,
    base_phrasal: row.base_phrasal?.word?.word,
  };
};
