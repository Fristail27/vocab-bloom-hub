import { EnWord } from '../../../src/modules/EnModule/entities/en_word.entity';
import {
  EnMeaningT,
  EnMeaningTranslationT,
  EnPhrasalObjectPatternE,
  EnShortTranslationT,
  EnVerbTransitivityE,
  EnWordFormT,
  LanguageRegisterE,
  WordLevelE,
} from '../';

export type EnMeaningTranslationDST = Omit<EnMeaningTranslationT, 'id'>;
export type EnMeaningDST = Omit<EnMeaningT, 'id' | 'translations' | 'meaning_level' | 'language_register'> & {
  translations: EnMeaningTranslationDST[];
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
};
