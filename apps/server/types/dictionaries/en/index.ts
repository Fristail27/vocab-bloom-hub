import { EnWord } from '../../../src/modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../../../src/modules/EnModule/entities/en_meaning.entity';
import { EnShortTranslation } from '../../../src/modules/EnModule/entities/en_short_translation.entity';
import { EnMeaningTranslation } from '../../../src/modules/EnModule/entities/en_meaning_translation.entity';
import { AvailableTranslationLanguagesE, CategoryE, LanguageRegisterE, WordLevelE } from '../index';

export enum EnEntryTypesE {
  word = 'word',
  grammar_pattern = 'grammar_pattern',
  phrase = 'phrase',
}

export enum EnPartOfSpeechE {
  noun = 'noun',
  verb = 'verb',
  modal_verb = 'modal_verb',
  adjective = 'adjective',
  adverb = 'adverb',
  pronoun = 'pronoun',
  numeral = 'numeral',
  numeral_fractional = 'numeral_fractional',
  determiner = 'determiner',
  interjection = 'interjection',
  article = 'article',
  preposition = 'preposition',
  conjunction = 'conjunction',
  letter = 'letter',
  phrase = 'phrase',
  grammar_pattern = 'grammar_pattern',
}

export enum EnAreaVariantsE {
  common = 'common',
  british = 'british',
  american = 'american',
  australian = 'australian',
}

export enum EnWordFormsE {
  base_form = 'base_form',
  plural_form = 'plural_form',
  possessive_singular_form = 'possessive_singular_form',
  possessive_plural_form = 'possessive_plural_form',
  past_simple = 'past_simple',
  past_participle = 'past_participle',
  present_participle = 'present_participle',
  third_person_singular = 'third_person_singular',
  comparative_form = 'comparative_form',
  superlative_form = 'superlative_form',
  object = 'object', // me
  possessive_adjective = 'possessive_adjective', // my
  possessive_pronoun = 'possessive_pronoun', // mine
  reflexive = 'reflexive', // myself
  ordinal = 'ordinal', // first
  multiplicative = 'multiplicative', // once
}

export enum EnPhrasalObjectPatternE {
  no_object = 'no_object', // wake up
  inseparable = 'inseparable', // look after sb
  separable = 'separable', // turn off the light / turn the light off
  separable_pronoun_only = 'separable_pronoun_only', // turn it off ONLY
}

export enum EnVerbTransitivityE {
  transitive = 'transitive',
  intransitive = 'intransitive',
  both = 'both',
}

export type EnMeaningTranslationT = Omit<EnMeaningTranslation, 'updateAt' | 'createdAt' | 'meaning'>;
export type EnMeaningT = Omit<EnMeaning, 'updateAt' | 'createdAt' | 'translations' | 'word'> & {
  translations: EnMeaningTranslationT[];
};
export type EnShortTranslationT = Omit<EnShortTranslation, 'updateAt' | 'createdAt' | 'word_entry' | 'word'>;

export type EnWordFormT = Pick<
  Omit<EnWordT, 'forms'>,
  'id' | 'area_variant' | 'transcription' | 'form_of_word' | 'word' | 'is_obsolete'
>;

export type EnWordT = Omit<
  EnWord,
  'createdAt' | 'updateAt' | 'meanings' | 'short_translations' | 'forms' | 'base_phrasal' | 'word' | 'base_form'
> & {
  word: string;
  meanings: EnMeaningT[];
  short_translations: EnShortTranslationT[];
  forms: EnWordFormT[];
  base_phrasal: string | undefined;
  base_form?: Omit<EnWordT, 'base_form'> | undefined;
};

export type DictionaryWordJSONT = {
  is_obsolete: boolean;
  word_level?: WordLevelE | 'unknown' | undefined | null;
  area_variant: EnAreaVariantsE;
  category?: CategoryE | 'unknown' | undefined | null;
  language_register: LanguageRegisterE | 'unknown' | null;
  part_of_speech: EnPartOfSpeechE;
  form_of_word: EnWordFormsE;
  description: string;
  transcription: string;
  noun___irregular_plural: boolean | null;
  noun___countable: boolean | null;
  noun___is_proper: boolean | null;
  verb___is_irregular: boolean | null;
  verb___transitivity: EnVerbTransitivityE | 'unknown' | null;
  verb___is_phrasal: boolean | null;
  verb___phrasal_object_pattern: EnPhrasalObjectPatternE | 'unknown' | null;
  word: string;
  pattern: null;
  generated: boolean | null;
  generatedByModel: string | null;
  is_abbreviation: boolean | null;
  is_hyphenated: boolean | null;
  word_info: { createdAt: string; updateAt: string; word: string; type: EnEntryTypesE };
  forms: Array<{
    word: string;
    form_of_word: EnWordFormsE;
    transcription: string;
    area_variant: EnAreaVariantsE;
    is_obsolete: boolean | null;
  }>;
  meanings: Array<{
    sort_order: number;
    title: string;
    definition: string;
    examples: string[];
    category?: CategoryE | 'unknown' | undefined | null;
    meaning_level?: WordLevelE | 'unknown' | undefined | null;
    area_variant: EnAreaVariantsE;
    language_register: LanguageRegisterE | 'unknown' | null;
    translations: Array<{
      id: number;
      language: AvailableTranslationLanguagesE;
      title: string;
      definition: string;
      variantsOfWords: string[];
    }>;
  }>;
  short_translations: Array<{
    language: AvailableTranslationLanguagesE;
    description: string;
    variantsOfWords: string[];
  }>;
};
