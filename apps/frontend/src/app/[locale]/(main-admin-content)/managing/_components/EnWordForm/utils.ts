import {
  EnAreaVariantsE,
  EnMeaningT,
  EnPhrasalObjectPatternE,
  EnVerbTransitivityE,
  EnWordFormsE,
  EnWordFormT,
  EnWordT,
} from 'server/types';
import { CommonInfoDataT } from './types';
import { DefaultCommonData, EnWordFormModeE } from './constants';
import { TranslatorT } from '@/types/common';

export const getDefaultSubForm = (key: EnWordFormsE): EnWordFormT => {
  return {
    word: '',
    area_variant: EnAreaVariantsE.common,
    transcription: '',
    id: Math.ceil(Math.random() * 100000000),
    form_of_word: key,
  };
};

export const getInitCommonInfo = (w?: EnWordT | undefined): CommonInfoDataT => {
  if (!w) {
    return DefaultCommonData;
  }
  return {
    id: w.id,
    form_of_word: w.form_of_word,
    generated: true,
    generated_by_model: 'unknown',
    categories: [],
    verb___is_phrasal: !!w.verb___is_phrasal,
    transcription: w.transcription || '',
    area_variant: w.area_variant,
    verb___phrasal_object_pattern: w.verb___phrasal_object_pattern as EnPhrasalObjectPatternE,
    verb___is_irregular: !!w.verb___is_irregular,
    verb___transitivity: w.verb___transitivity as EnVerbTransitivityE,
    language_register: w.language_register,
    description: w.description || '',
    is_obsolete: !!w.is_obsolete,
    is_abbreviation: w.is_abbreviation,
    word_level: w.word_level || null,
    noun___irregular_plural: !!w.noun___irregular_plural,
    noun___is_proper: !!w.noun___is_proper,
    noun___uncountable: !!w.noun___uncountable,
    base_phrasal: w.base_phrasal || undefined,
  };
};

export const mapInitForms = (forms: EnWordFormT[]): EnWordFormT[] => {
  return forms.map((w) => ({
    word: w.word,
    id: w.id,
    area_variant: w.area_variant,
    transcription: w.transcription || '',
    form_of_word: w.form_of_word,
  }));
};

export const getInitMeanings = (meanings: EnMeaningT[] = []): EnMeaningT[] => {
  return [...meanings]
    .map((m) => ({
      ...m,
      translation: m.translations.map((t) => t),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
};

export const getStepItems = (t: TranslatorT, mode: EnWordFormModeE, allDisabled: boolean = false) => {
  const res = [
    { title: t('basic_information'), disabled: allDisabled },
    { title: t('word_forms'), disabled: allDisabled },
    { title: t('word_meanings'), disabled: allDisabled },
    { title: t('short_translations'), disabled: allDisabled },
    { title: t('meaning_translations'), disabled: allDisabled },
    { title: t('save_word'), disabled: allDisabled },
  ];

  if (mode === EnWordFormModeE.add) {
    res.unshift({ title: t('checking_word'), disabled: true });
  }
  return res;
};
