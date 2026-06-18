import { EnMeaningTranslationT } from 'server/types';

export type AddOrEditStateT = {
  language: EnMeaningTranslationT['language'];
  definition: EnMeaningTranslationT['definition'];
  title: EnMeaningTranslationT['title'];
  variants_of_words: EnMeaningTranslationT['variants_of_words'];
};
