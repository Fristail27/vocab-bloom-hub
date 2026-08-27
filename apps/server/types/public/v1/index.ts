import type {
  EnMeaningT,
  EnMeaningTranslationT,
  EnPartOfSpeechE,
  EnSearchWordT,
  EnShortTranslationT,
  EnWordFormT,
  EnWordT,
} from '../../dictionaries/en';
import type { ErrorResT } from '../../errors';

/**
 * Contract of the public read-only API, `/api/v1` (issues #271, #272). The
 * shapes here are what consuming applications rely on: they change only with
 * a new version prefix. Errors reuse ErrorResT (`{ statusCode, message,
 * error: true }`), every response carries `X-API-Version: 1`.
 */
export const PUBLIC_API_V1_VERSION = '1';

// Every successful answer is an envelope: the payload under `data`, paging
// and counts under `meta`. Single resources travel as `{ data }` alone
export type PublicItemResT<TItem> = { data: TItem };
export type PublicListResT<TItem, TMeta> = { data: TItem[]; meta: TMeta };

// `fuzzy`: the exact tiers found nothing and the items come from the trigram
// similarity tier (Postgres instances only, issue #278); every item then
// carries `similarity` (0–1) — the "did you mean" signal
export type PublicSearchV1MetaT = { count: number; fuzzy: boolean };
export type PublicSearchV1ResT = PublicListResT<EnSearchWordT, PublicSearchV1MetaT>;

export type PublicSearchDetailedV1MetaT = { page: number; limit: number; has_more: boolean; fuzzy: boolean };
export type PublicSearchDetailedV1ResT = PublicListResT<EnWordT, PublicSearchDetailedV1MetaT>;

// ------------------------------------------------------------ words (#272)

// One dictionary entry with everything attached: forms, meanings (with their
// translations, synonyms and antonyms) and short translations
export type PublicWordV1T = EnWordT;
export type PublicWordV1ResT = PublicItemResT<PublicWordV1T>;

// Every headword lookup answers for one spelling; `count` is the number of
// entries (parts of speech) found for it
export type PublicHeadwordV1MetaT = { word: string; count: number };
export type PublicHeadwordV1ResT = PublicListResT<PublicWordV1T, PublicHeadwordV1MetaT>;

// The partial reads flatten the entries of a headword into one list; every
// item names the entry it belongs to (`word_id`, `part_of_speech`)
export type PublicEntryRefV1T = { word_id: number; part_of_speech: EnPartOfSpeechE };

export type PublicMeaningV1T = EnMeaningT & PublicEntryRefV1T;
export type PublicHeadwordMeaningsV1ResT = PublicListResT<PublicMeaningV1T, PublicHeadwordV1MetaT>;

export type PublicWordFormV1T = EnWordFormT & PublicEntryRefV1T;
export type PublicHeadwordFormsV1ResT = PublicListResT<PublicWordFormV1T, PublicHeadwordV1MetaT>;

export type PublicShortTranslationV1T = EnShortTranslationT & PublicEntryRefV1T;
export type PublicMeaningTranslationV1T = EnMeaningTranslationT & PublicEntryRefV1T & { meaning_id: number };
export type PublicHeadwordTranslationsV1T = {
  short_translations: PublicShortTranslationV1T[];
  meaning_translations: PublicMeaningTranslationV1T[];
};
export type PublicHeadwordTranslationsV1ResT = PublicItemResT<PublicHeadwordTranslationsV1T> & {
  meta: PublicHeadwordV1MetaT;
};

// Cursor pagination: `next_cursor` is an opaque token to pass back as
// `?cursor=`; null on the last page. Items are ordered by (word, id)
export type PublicWordsV1MetaT = { limit: number; has_more: boolean; next_cursor: string | null };
export type PublicWordsV1ResT = PublicListResT<PublicWordV1T, PublicWordsV1MetaT>;

// ------------------------------------------------------------- meta (#272)

export type PublicDatasetCountsV1T = {
  entries: number;
  words: number;
  phrases: number;
  grammar_patterns: number;
  word_forms: number;
  meanings: number;
  meaning_translations: number;
  short_translations: number;
};

export type PublicMetaV1T = {
  api_version: string;
  // version of the server (package.json)
  app_version: string;
  // version of the dataset the dictionary was last imported from; null when
  // the data was authored in place or imported from a dataset without a manifest
  dataset_version: string | null;
  // SPDX identifier of the dictionary data license; null until it is decided (issue #270)
  license: string | null;
  counts: PublicDatasetCountsV1T;
};
export type PublicMetaV1ResT = PublicItemResT<PublicMetaV1T>;

export type PublicApiErrorT = ErrorResT & { statusCode: number };
