import { EnMeaningTranslation } from '../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../entities/en_short_translation.entity';
import { EnMeaningTranslationT, EnShortTranslationT } from '../../../../types';

// The API types omit the timestamps and the owner relation; the rows must
// lose them too, otherwise the public contract leaks what the types hide
export const prepareMeaningTranslationFromDB = (row: EnMeaningTranslation): EnMeaningTranslationT => {
  const { createdAt: _createdAt, updateAt: _updateAt, meaning: _meaning, ...rest } = row;
  return rest;
};

export const prepareShortTranslationFromDB = (row: EnShortTranslation): EnShortTranslationT => {
  const { createdAt: _createdAt, updateAt: _updateAt, word: _word, ...rest } = row;
  return rest;
};
