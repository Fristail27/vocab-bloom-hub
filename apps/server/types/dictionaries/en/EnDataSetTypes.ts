import { EnWord } from '../../../src/modules/EnModule/entities/en_word.entity';
import {
  EnMeaningT,
  EnMeaningTranslationT,
  EnPartOfSpeechE,
  EnPhrasalObjectPatternE,
  EnShortTranslationT,
  EnVerbTransitivityE,
  EnWordFormT,
  LanguageRegisterE,
  WordLevelE,
} from '../';

export type EnMeaningTranslationDST = Omit<EnMeaningTranslationT, 'id'>;
// A synonym in the dataset names the word together with its part of speech,
// so the file is readable on its own; the database stores the link by headword
export type EnSynonymDST = { word: string; part_of_speech: EnPartOfSpeechE };
export type EnMeaningDST = Omit<
  EnMeaningT,
  'id' | 'translations' | 'meaning_level' | 'language_register' | 'synonyms'
> & {
  translations: EnMeaningTranslationDST[];
  synonyms: EnSynonymDST[];
  meaning_level: WordLevelE | '';
  language_register: LanguageRegisterE | '';
};
export type EnShortTranslationDST = Omit<EnShortTranslationT, 'id'>;
export type EnWordFormDST = Omit<EnWordFormT, 'id'>;

export type DataSetWordT = Omit<
  EnWord,
  | 'createdAt'
  | 'updateAt'
  | 'meanings'
  | 'short_translations'
  | 'forms'
  | 'pattern'
  | 'base_phrasal'
  | 'word'
  | 'base_form'
  | 'phrasal_variants'
  | 'id'
  | 'form_of_word'
  | 'word_level'
  | 'verb___transitivity'
  | 'verb___phrasal_object_pattern'
> & {
  word: string;
  word_level: WordLevelE | '';
  verb___transitivity: EnVerbTransitivityE | '';
  verb___phrasal_object_pattern: EnPhrasalObjectPatternE | '';
  meanings: EnMeaningDST[];
  short_translations: EnShortTranslationDST[];
  forms: EnWordFormDST[];
  base_phrasal: string;
  phrasal_variants: string[];
  version: string;
};

export type DataSetPhraseT = Omit<
  EnWord,
  | 'createdAt'
  | 'updateAt'
  | 'meanings'
  | 'short_translations'
  | 'forms'
  | 'pattern'
  | 'base_phrasal'
  | 'word'
  | 'base_form'
  | 'phrasal_variants'
  | 'id'
  | 'form_of_word'
  | 'word_level'
  | 'verb___transitivity'
  | 'verb___phrasal_object_pattern'
  | 'verb___is_phrasal'
  | 'verb___is_irregular'
  | 'noun___uncountable'
  | 'noun___is_proper'
  | 'noun___irregular_plural'
  | 'noun___always_plural'
  | 'is_abbreviation'
  | 'part_of_speech'
> & {
  phrase: string;
  level: WordLevelE | '';
  meanings: EnMeaningDST[];
  short_translations: EnShortTranslationDST[];
  version: string;
};

export type DataSetGrammarPatternT = DataSetPhraseT & { pattern: string[] };
