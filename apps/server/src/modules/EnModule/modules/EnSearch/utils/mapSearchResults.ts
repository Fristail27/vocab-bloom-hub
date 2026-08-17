import { EnSearchWordT } from '../../../../../../types';
import { prepareWordForm } from '../../../utils/prepareWordForm';
import { EnWord } from '../../../entities/en_word.entity';

export const mapSearchResults = (words: EnWord[]): EnSearchWordT[] => {
  return words.map((w) => ({
    ...w,
    phrasal_variants: undefined,
    word: w.word.word,
    forms: (w.forms || [])?.map(prepareWordForm),
    base_phrasal: w.base_phrasal?.word?.word,
    base_form: undefined,
  }));
};
