import { EnWord } from '../entities/en_word.entity';
import { EnWordT } from '../../../../types';
import { prepareWordForm } from './prepareWordForm';

export const prepareWordFromDB = (row: EnWord): EnWordT => {
  const { createdAt: _createdAt, updateAt: _updateAt, ...other } = row;
  return {
    ...other,
    word: row.word.word,
    forms: (row.forms || [])?.map(prepareWordForm),
    meanings: row.meanings,
    phrasal_variants: undefined,
    base_form: undefined,
    base_phrasal: row.base_phrasal?.word?.word,
  };
};
