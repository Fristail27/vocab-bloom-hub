import { EnMeaning } from '../entities/en_meaning.entity';
import { EnMeaningT } from '../../../../types';
import { normalizeSynonyms } from './normalizeSynonyms';

/**
 * Maps a meaning row to its API shape: the `synonyms` relation (links to
 * `en_entries`) becomes the sorted list of headwords. A row loaded without the
 * relation yields an empty list.
 */
export const prepareMeaningFromDB = (m: EnMeaning): EnMeaningT => {
  const { createdAt: _createdAt, updateAt: _updateAt, word: _word, synonyms, translations, ...rest } = m;
  return {
    ...rest,
    translations: translations ?? [],
    synonyms: normalizeSynonyms(synonyms?.map((entry) => entry.word)),
  };
};
