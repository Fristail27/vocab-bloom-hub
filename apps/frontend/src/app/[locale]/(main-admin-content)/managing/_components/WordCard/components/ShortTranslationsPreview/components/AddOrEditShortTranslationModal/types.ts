import { EnShortTranslationT } from 'server/types';

export type AddOrEditStateT = {
  language: EnShortTranslationT['language'];
  description: EnShortTranslationT['description'];
  variants_of_words: EnShortTranslationT['variants_of_words'];
};
