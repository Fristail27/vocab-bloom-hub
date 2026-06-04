import { EnWord } from '../entities/en_word.entity';
import { EnWordFormT } from '../../../../types';

export const prepareWordForm = (w: EnWord): EnWordFormT => {
  return {
    id: w.id,
    word: w.word.word,
    form_of_word: w.form_of_word,
    area_variant: w.area_variant,
    transcription: w.transcription,
  };
};
