import { EnMeaning } from '../entities/en_meaning.entity';
import { EnMeaningT } from '../../../../types';
import { normalizeWordLinks } from './normalizeWordLinks';

/**
 * Maps a meaning row to its API shape: the `synonyms` and `antonyms`
 * relations (links to `en_entries`) become sorted lists of headwords. A row
 * loaded without a relation yields an empty list for it.
 */
export const prepareMeaningFromDB = (m: EnMeaning): EnMeaningT => {
  const {
    createdAt: _createdAt,
    updateAt: _updateAt,
    word: _word,
    synonyms,
    antonyms,
    translations,
    ...rest
  } = m;
  return {
    ...rest,
    translations: translations ?? [],
    synonyms: normalizeWordLinks(synonyms?.map((entry) => entry.word)),
    antonyms: normalizeWordLinks(antonyms?.map((entry) => entry.word)),
  };
};
