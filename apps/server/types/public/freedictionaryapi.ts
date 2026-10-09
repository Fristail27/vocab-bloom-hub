import type { DictionaryApiEntryT, DictionaryApiLicenseT } from './dictionaryapi';
import type { PublicDatasetTermsV1T } from './v1';

export type FreeDictionaryLanguageT = { code: string; name: string };
export type FreeDictionaryLanguagesResT = (FreeDictionaryLanguageT & {
  /** @asType integer */
  words: number;
})[];
export type FreeDictionarySenseT = {
  definition: string;
  tags: string[];
  examples: string[];
  quotes: { text: string; reference: string }[];
  synonyms: string[];
  antonyms: string[];
  translations?: { language: FreeDictionaryLanguageT; word: string }[];
  subsenses: FreeDictionarySenseT[];
};
export type FreeDictionaryEntryT = {
  language: FreeDictionaryLanguageT;
  partOfSpeech: string;
  pronunciations: { type: 'ipa' | 'enpr'; text: string; tags: string[] }[];
  forms: { word: string; tags: string[] }[];
  senses: FreeDictionarySenseT[];
  synonyms: string[];
  antonyms: string[];
  /** Native entry identity and lossless terms; additive to the upstream format. */
  vocabBloom: DictionaryApiEntryT['vocabBloom'] & { word: string };
};
export type FreeDictionaryEntriesResT = {
  word: string;
  entries: FreeDictionaryEntryT[];
  source: { url: string; license: DictionaryApiLicenseT };
  /** Active dataset terms. Word-specific origins are retained on each entry. */
  vocabBloom: PublicDatasetTermsV1T;
};
/** Upstream parameter errors are plain text, not the native error envelope. */
export type FreeDictionaryErrorT = string;
