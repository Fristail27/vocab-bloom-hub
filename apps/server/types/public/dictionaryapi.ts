import type { OriginT, OriginLicenseT, WordLicenseT } from '../provenance';

export type DictionaryApiLicenseT = { name: string; url: string };
export type DictionaryApiDefinitionT = {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
};
export type DictionaryApiPhoneticT = {
  text?: string;
  audio: string;
  sourceUrl?: string;
  license?: DictionaryApiLicenseT;
  /** Lossless recording terms; the upstream singular license cannot express all of these. */
  vocabBloom?: { attribution: string | null; licenses: OriginLicenseT[] };
};
export type DictionaryApiMeaningT = {
  partOfSpeech: string;
  definitions: DictionaryApiDefinitionT[];
  synonyms: string[];
  antonyms: string[];
};
export type DictionaryApiEntryT = {
  word: string;
  phonetic?: string;
  phonetics: DictionaryApiPhoneticT[];
  origin?: string;
  license?: DictionaryApiLicenseT;
  sourceUrls: string[];
  /** Complete terms and modification indication, additive to the upstream shape. */
  vocabBloom: {
    dataset: string;
    source: string;
    modified: boolean;
    origins: OriginT[];
    contributions: OriginT[];
    licenses: WordLicenseT[];
  };
};
export type DictionaryApiV2ResT = (DictionaryApiEntryT & { meanings: DictionaryApiMeaningT[] })[];
export type DictionaryApiV1ResT = (DictionaryApiEntryT & {
  meaning: Record<string, DictionaryApiDefinitionT[]>;
})[];
export type DictionaryApiErrorT = { title: string; message: string; resolution: string };
