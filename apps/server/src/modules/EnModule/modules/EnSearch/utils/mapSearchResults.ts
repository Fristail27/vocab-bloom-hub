import { EnSearchWordT } from '../../../../../../types';
import { prepareWordForm } from '../../../utils/prepareWordForm';
import { EnWord } from '../../../entities/en_word.entity';

/** `similarity`: the fuzzy tier's score per word id; absent from exact answers */
export const mapSearchResults = (words: EnWord[], similarity?: Map<number, number>): EnSearchWordT[] => {
  // the timestamps are not part of the contract (EnWordT omits them)
  return words.map(({ createdAt: _createdAt, updateAt: _updateAt, ...w }) => ({
    ...w,
    phrasal_variants: undefined,
    word: w.word.word,
    forms: (w.forms || [])?.map(prepareWordForm),
    base_phrasal: w.base_phrasal?.word?.word,
    base_form: undefined,
    ...(similarity?.has(w.id) && { similarity: similarity.get(w.id) }),
  }));
};
