import { EnWord } from '../entities/en_word.entity';
import { EnWordT } from '../../../../types';
import { prepareWordForm } from './prepareWordForm';

export const prepareWordFromDB = (row: EnWord): EnWordT => {
  return {
    ...row,
    word: row.word.word,
    forms: (row.forms || [])?.map(prepareWordForm),
    meanings: row.meanings,
    phrasal_variants: undefined,
    base_form: undefined,
    base_phrasal: row.base_phrasal?.word?.word,
  };
};
