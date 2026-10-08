import { adminPronunciations } from './pronunciations';
import { alternativeSpellings } from './entryAlternatives';
import { EnWord } from '../entities/en_word.entity';
import { EnAreaVariantsE, EnWordFormT } from '../../../../types';

export const prepareWordForm = (w: EnWord): EnWordFormT => {
  return {
    id: w.id,
    pronunciations: adminPronunciations(w),
    alternatives: alternativeSpellings(w.word),
    word: w.word.word,
    form_of_word: w.form_of_word,
    // the column is nullable, the form contract is not: an unmarked form is common
    area_variant: w.area_variant ?? EnAreaVariantsE.common,
    transcription: w.transcription,
  };
};
