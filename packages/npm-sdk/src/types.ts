/**
 * The public contract, under readable names. Everything here is derived
 * from the generated OpenAPI types (`src/generated/openapi.ts`, produced
 * from the server's `openapi/public-v1.json`), so it cannot drift from the
 * API. The generated module stays importable for anything not aliased.
 */
import type { components, operations } from './generated/openapi';

type Schemas = components['schemas'];

// ------------------------------------------------------------- entities
export type Word = Schemas['EnWordT'];
export type SearchWord = Schemas['EnSearchWordT'];
export type Meaning = Schemas['PublicMeaningV1T'];
export type WordForm = Schemas['PublicWordFormV1T'];
export type ShortTranslation = Schemas['PublicShortTranslationV1T'];
export type MeaningTranslation = Schemas['PublicMeaningTranslationV1T'];
export type HeadwordTranslations = Schemas['PublicHeadwordTranslationsV1T'];
export type Meta = Schemas['PublicMetaV1T'];
export type DatasetCounts = Schemas['PublicDatasetCountsV1T'];
export type ApiError = Schemas['PublicApiErrorT'];

// ----------------------------------------------------------------- enums
export type PartOfSpeech = Schemas['EnPartOfSpeechE'];
export type WordLevel = Schemas['WordLevelE'];
export type LanguageRegister = Schemas['LanguageRegisterE'];
export type Category = Schemas['CategoryE'];
export type AreaVariant = Schemas['EnAreaVariantsE'];
export type WordFormKind = Schemas['EnWordFormsE'];
export type VerbTransitivity = Schemas['EnVerbTransitivityE'];
export type PhrasalObjectPattern = Schemas['EnPhrasalObjectPatternE'];

// -------------------------------------------------------------- requests
export type SearchRequest = Schemas['SearchV1ReqDTO'];
export type DetailedSearchRequest = Schemas['SearchDetailedV1ReqDTO'];
export type WordFilters = NonNullable<operations['PublicDictionaryController_random']['parameters']['query']>;
export type ListWordsQuery = NonNullable<operations['PublicWordsController_list']['parameters']['query']>;
export type TranslationsQuery = NonNullable<
  operations['PublicWordsController_translations']['parameters']['query']
>;

// ------------------------------------------------------------- responses
export type SearchResponse = Schemas['PublicSearchV1ResT'];
export type DetailedSearchResponse = Schemas['PublicSearchDetailedV1ResT'];
export type WordResponse = Schemas['PublicWordV1ResT'];
export type HeadwordResponse = Schemas['PublicHeadwordV1ResT'];
export type MeaningsResponse = Schemas['PublicHeadwordMeaningsV1ResT'];
export type TranslationsResponse = Schemas['PublicHeadwordTranslationsV1ResT'];
export type FormsResponse = Schemas['PublicHeadwordFormsV1ResT'];
export type WordsResponse = Schemas['PublicWordsV1ResT'];
export type MetaResponse = Schemas['PublicMetaV1ResT'];
