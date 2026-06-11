import { CommonInfoDataT } from './types';
import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnPhrasalObjectPatternE,
  EnShortTranslationT,
  EnVerbTransitivityE,
  EnWordFormsE,
  LanguageRegisterE,
} from 'server/types';

export enum EnWordFormModeE {
  edit = 'edit',
  add = 'add',
}

export const EnPartsOfSpeech = [
  { value: 'noun', label: 'noun' },
  { value: 'verb', label: 'verb' },
  { value: 'modal_verb', label: 'modal verb' },
  { value: 'adjective', label: 'adjective' },
  { value: 'adverb', label: 'adverb' },
  { value: 'pronoun', label: 'pronoun' },
  { value: 'numeral', label: 'numeral' },
  { value: 'numeral_fractional', label: 'num. fractional' },
  { value: 'determiner', label: 'determiner' },
  { value: 'article', label: 'article' },
  { value: 'interjection', label: 'interjection' },
  { value: 'preposition', label: 'preposition' },
  { value: 'conjunction', label: 'conjunction' },
  { value: 'letter', label: 'letter' },
];

export const FormsByPartOfSpeech: Record<EnPartOfSpeechE, EnWordFormsE[]> = {
  [EnPartOfSpeechE.noun]: [
    EnWordFormsE.plural_form,
    EnWordFormsE.possessive_singular_form,
    EnWordFormsE.possessive_plural_form,
  ],
  [EnPartOfSpeechE.verb]: [
    EnWordFormsE.past_simple,
    EnWordFormsE.past_participle,
    EnWordFormsE.present_participle,
    EnWordFormsE.third_person_singular,
  ],
  [EnPartOfSpeechE.adverb]: [EnWordFormsE.comparative_form, EnWordFormsE.superlative_form],
  [EnPartOfSpeechE.adjective]: [EnWordFormsE.comparative_form, EnWordFormsE.superlative_form],
  [EnPartOfSpeechE.numeral]: [EnWordFormsE.ordinal, EnWordFormsE.multiplicative],
  [EnPartOfSpeechE.pronoun]: [
    EnWordFormsE.object,
    EnWordFormsE.possessive_adjective,
    EnWordFormsE.possessive_pronoun,
    EnWordFormsE.reflexive,
  ],
  [EnPartOfSpeechE.modal_verb]: [],
  [EnPartOfSpeechE.numeral_fractional]: [],
  [EnPartOfSpeechE.determiner]: [],
  [EnPartOfSpeechE.interjection]: [],
  [EnPartOfSpeechE.article]: [],
  [EnPartOfSpeechE.preposition]: [],
  [EnPartOfSpeechE.conjunction]: [],
  [EnPartOfSpeechE.letter]: [],
  [EnPartOfSpeechE.phrase]: [],
  [EnPartOfSpeechE.grammar_pattern]: [],
};

export const DefaultShortTranslation: EnShortTranslationT[] = [
  {
    id: 0,
    language: AvailableTranslationLanguagesE.ru,
    variantsOfWords: [],
    description: '',
  },
];

export const DefaultCommonData: CommonInfoDataT = {
  id: 0,
  generated: true,
  form_of_word: EnWordFormsE.base_form,
  generated_by_model: 'GPT-5.3-mini',
  categories: null,
  word_level: null,
  is_obsolete: false,
  is_abbreviation: null,
  language_register: LanguageRegisterE.formal,
  area_variant: EnAreaVariantsE.common,
  transcription: '',
  description: '',
  noun___uncountable: false,
  noun___is_proper: false,
  noun___irregular_plural: false,
  verb___is_irregular: false,
  verb___transitivity: EnVerbTransitivityE.both,
  verb___is_phrasal: false,
  base_phrasal: '',
  verb___phrasal_object_pattern: EnPhrasalObjectPatternE.separable,
};
