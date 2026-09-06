import type {
  EnMeaningT,
  EnMeaningTranslationT,
  EnPartOfSpeechE,
  EnSearchWordT,
  EnShortTranslationT,
  EnWordFormT,
  EnWordT,
} from '../../dictionaries/en';
import type { AvailableTranslationLanguagesE } from '../../dictionaries';
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
// carries `similarity` (0–1) — the "did you mean" signal.
// `short_term`: the term has fewer than 3 characters, so only the exact and
// prefix tiers were searched (issue #292)
export type PublicSearchV1MetaT = {
  /** @asType integer */
  count: number;
  fuzzy: boolean;
  short_term: boolean;
};
export type PublicSearchV1ResT = PublicListResT<EnSearchWordT, PublicSearchV1MetaT>;

export type PublicSearchDetailedV1MetaT = {
  /** @asType integer */
  page: number;
  /** @asType integer */
  limit: number;
  has_more: boolean;
  fuzzy: boolean;
  short_term: boolean;
};
export type PublicSearchDetailedV1ResT = PublicListResT<EnWordT, PublicSearchDetailedV1MetaT>;

// ------------------------------------------------------------ words (#272)

// One dictionary entry with everything attached: forms, meanings (with their
// translations, synonyms and antonyms) and short translations
export type PublicWordV1T = EnWordT;
export type PublicWordV1ResT = PublicItemResT<PublicWordV1T>;

// Every headword lookup answers for one spelling; `count` is the number of
// entries (parts of speech) found for it
export type PublicHeadwordV1MetaT = {
  word: string;
  /** @asType integer */
  count: number;
};
export type PublicHeadwordV1ResT = PublicListResT<PublicWordV1T, PublicHeadwordV1MetaT>;

// The partial reads flatten the entries of a headword into one list; every
// item names the entry it belongs to (`word_id`, `part_of_speech`)
export type PublicEntryRefV1T = {
  /** @asType integer */
  word_id: number;
  part_of_speech: EnPartOfSpeechE;
};

export type PublicMeaningV1T = EnMeaningT & PublicEntryRefV1T;
export type PublicHeadwordMeaningsV1ResT = PublicListResT<PublicMeaningV1T, PublicHeadwordV1MetaT>;

export type PublicWordFormV1T = EnWordFormT & PublicEntryRefV1T;
export type PublicHeadwordFormsV1ResT = PublicListResT<PublicWordFormV1T, PublicHeadwordV1MetaT>;

export type PublicShortTranslationV1T = EnShortTranslationT & PublicEntryRefV1T;
export type PublicMeaningTranslationV1T = EnMeaningTranslationT &
  PublicEntryRefV1T & {
    /** @asType integer */
    meaning_id: number;
  };
export type PublicHeadwordTranslationsV1T = {
  short_translations: PublicShortTranslationV1T[];
  meaning_translations: PublicMeaningTranslationV1T[];
};
export type PublicHeadwordTranslationsV1ResT = PublicItemResT<PublicHeadwordTranslationsV1T> & {
  meta: PublicHeadwordV1MetaT;
};

// Batch lookup (issue #397): one item per requested spelling that names
// entries, in request order (duplicates and case collapse); `word` is the
// normalized spelling as `meta.word` of the single lookup, `entries` what
// GET /words/{word} would answer. Spellings with no entry are listed in
// `meta.not_found` instead of failing the request
export type PublicWordsBatchItemV1T = {
  word: string;
  /** @asType integer */
  count: number;
  entries: PublicWordV1T[];
};
export type PublicWordsBatchV1MetaT = {
  /** @asType integer */
  count: number;
  not_found: string[];
};
export type PublicWordsBatchV1ResT = PublicListResT<PublicWordsBatchItemV1T, PublicWordsBatchV1MetaT>;

// Cursor pagination: `next_cursor` is an opaque token to pass back as
// `?cursor=`; null on the last page. Items are ordered by (word, id)
export type PublicWordsV1MetaT = {
  /** @asType integer */
  limit: number;
  has_more: boolean;
  next_cursor: string | null;
};
export type PublicWordsV1ResT = PublicListResT<PublicWordV1T, PublicWordsV1MetaT>;

// ------------------------------------------------------------- meta (#272)

export type PublicDatasetCountsV1T = {
  /** @asType integer */
  entries: number;
  /** @asType integer */
  words: number;
  /** @asType integer */
  phrases: number;
  /** @asType integer */
  grammar_patterns: number;
  /** @asType integer */
  word_forms: number;
  /** @asType integer */
  meanings: number;
  /** @asType integer */
  meaning_translations: number;
  /** @asType integer */
  short_translations: number;
};

export type PublicMetaV1T = {
  api_version: string;
  // version of the server (package.json)
  app_version: string;
  // version of the dataset the dictionary was last imported from; null when
  // the data was authored in place or imported from a dataset without a manifest
  dataset_version: string | null;
  // the dictionary data license (issue #270): SPDX identifier, its text, and
  // the attribution line a consumer has to show
  license: string;
  license_url: string;
  attribution: string;
  counts: PublicDatasetCountsV1T;
  available_languages: PublicAvailableLanguagesV1T;
};
// The languages the instance serves (issue #394): `source` is the language of
// the headwords (`en` only, structural), `translations` the languages a
// translation may carry — the values `?language=` accepts. Both are lists so
// a further language extends the answer without changing its shape
export type PublicAvailableLanguagesV1T = {
  source: string[];
  translations: AvailableTranslationLanguagesE[];
};
export type PublicMetaV1ResT = PublicItemResT<PublicMetaV1T>;

// ------------------------------------------------------ suggestions (#327)

// Answer of POST /api/v1/suggestions: the stored report. The endpoint has a
// strict rate limit of its own (a few reports per hour per client) and stops
// accepting once too many reports are waiting for the admin.
export type PublicSuggestionCreatedV1T = {
  /** @asType integer */
  id: number;
  status: string;
};
export type PublicSuggestionCreatedV1ResT = PublicItemResT<PublicSuggestionCreatedV1T>;

export type PublicApiErrorT = ErrorResT & {
  /** @asType integer */
  statusCode: number;
};
