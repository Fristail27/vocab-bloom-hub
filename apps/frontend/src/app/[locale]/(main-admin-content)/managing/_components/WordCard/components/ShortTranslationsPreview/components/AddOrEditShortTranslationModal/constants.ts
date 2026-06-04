import { AddOrEditStateT } from './types';
import { AvailableTranslationLanguagesE } from 'server/types';

export const DefaultState: AddOrEditStateT = {
  language: AvailableTranslationLanguagesE.ru,
  description: '',
  variants_of_words: [],
};
