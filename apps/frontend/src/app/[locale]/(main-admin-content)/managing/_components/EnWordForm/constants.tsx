import React from 'react';
import { Icon } from '@/core/ui/Icon';
import { CommonInfoDataT } from './types';
import {
  EnWordFormsE,
  WordLevelE,
  EnAreaVariantsE,
  LanguageRegisterE,
  EnPartOfSpeechE,
  EnVerbTransitivityE,
  EnPhrasalObjectPatternE,
  AvailableTranslationLanguagesE,
  EnShortTranslationT,
} from '../../../../../../../../server/types';

export enum EnWordFormModeE {
  edit = 'edit',
  add = 'add',
}

export type GetStepItemsArg =
  | {
      word: string;
      pos: EnPartOfSpeechE;
    }
  | undefined;

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

export type FormWordT = {
  id: number;
  word: string;
  area_variant: EnAreaVariantsE;
  languageRegister?: LanguageRegisterE | undefined;
  transcription: string;
  form: EnWordFormsE;
};

export const AreaVariants = [
  { value: EnAreaVariantsE.common, label: 'Общее' },
  { value: EnAreaVariantsE.british, label: 'Британское' },
  { value: EnAreaVariantsE.american, label: 'Американское', icon: <Icon name="usaFlag" size="medium" /> },
  { value: EnAreaVariantsE.australian, label: 'Австралийское' },
];

export const Levels = [
  { value: WordLevelE.unknown, label: 'Не указано' },
  { value: WordLevelE.A1, label: 'A1' },
  { value: WordLevelE.A2, label: 'A2' },
  { value: WordLevelE.B1, label: 'B1' },
  { value: WordLevelE.B2, label: 'B2' },
  { value: WordLevelE.C1, label: 'C1' },
  { value: WordLevelE.C2, label: 'C2' },
];

export const FormsByPartOfSpeech = {
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
};

export const DefaultShortTranslation: EnShortTranslationT = {
  id: 0,
  language: AvailableTranslationLanguagesE.ru,
  variantsOfWords: [],
  description: '',
};

export const DefaultCommonData: CommonInfoDataT = {
  generated: true,
  generatedByModel: 'GPT-5.3-mini',
  category: null,
  word_level: WordLevelE.unknown,
  is_obsolete: false,
  is_abbreviation: null,
  language_register: LanguageRegisterE.formal,
  area_variant: EnAreaVariantsE.common,
  transcription: '',
  description: '',
  noun___countable: true,
  noun___is_proper: false,
  noun___irregular_plural: false,
  verb___is_irregular: false,
  verb___transitivity: EnVerbTransitivityE.both,
  verb___is_phrasal: false,
  base_phrasal: '',
  verb___phrasal_object_pattern: EnPhrasalObjectPatternE.separable,
};
