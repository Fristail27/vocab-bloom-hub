import {
  EnWordFormsE,
  WordLevelE,
  EnAreaVariantsE,
  EnVerbTransitivityE,
  EnPhrasalObjectPatternE,
  AvailableTranslationLanguagesE,
  CategoryE,
  EnWordT,
  EnShortTranslationT,
  EnMeaningT,
} from '../../../../../../../../server/types';
import { CommonInfoDataT } from './types';
import { EnWordFormModeE, DefaultCommonData, FormWordT, GetStepItemsArg } from './constants';

export const getDefaultSubForm = (key: EnWordFormsE): FormWordT => {
  return {
    word: '',
    area_variant: EnAreaVariantsE.common,
    transcription: '',
    id: Math.ceil(Math.random() * 100000000),
    form: key,
  };
};

export const getInitCommonInfo = (w?: EnWordT | undefined): CommonInfoDataT => {
  if (!w) {
    return DefaultCommonData;
  }
  return {
    generated: true,
    generatedByModel: 'unknown',
    category: CategoryE.unknown,
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
    word_level: w.word_level || WordLevelE.unknown,
    noun___irregular_plural: !!w.noun___irregular_plural,
    noun___is_proper: !!w.noun___is_proper,
    noun___countable: !!w.noun___countable,
    base_phrasal: w.base_phrasal?.word_text || undefined,
  };
};

export const mapInitForms = (forms: EnWordT[]): FormWordT[] => {
  return forms.map((w) => ({
    word: w.word_text,
    id: w.id,
    area_variant: w.area_variant,
    transcription: w.transcription || '',
    form: w.form_of_word,
  }));
};

export const getInitShortTranslations = (
  shortTranslations: EnShortTranslationT[] = [],
): EnShortTranslationT | undefined => {
  if (!shortTranslations || shortTranslations.length === 0) {
    return undefined;
  }
  const t = shortTranslations.find((t) => t.language === AvailableTranslationLanguagesE.ru);
  return t;
};

export const getInitMeanings = (meanings: EnMeaningT[] = []): EnMeaningT[] => {
  return [...meanings]
    .map((m) => ({
      ...m,
      translation: m.translation.map((t) => t),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
};

export const getStepItems = (data: GetStepItemsArg, mode: EnWordFormModeE) => {
  return [
    {
      title: 'Проверка слова',
      content: data?.word && `${data.word} - ${data.pos}`,
      disabled: !!data || mode === EnWordFormModeE.edit,
    },
    { title: 'Основное', disabled: !data && mode !== EnWordFormModeE.edit },
    { title: 'Формы слова', disabled: !data && mode !== EnWordFormModeE.edit },
    { title: 'Значения слова', disabled: !data && mode !== EnWordFormModeE.edit },
    { title: 'Короткий перевод', disabled: !data && mode !== EnWordFormModeE.edit },
    { title: 'Перевод значений', disabled: !data && mode !== EnWordFormModeE.edit },
    { title: 'Сохранение', disabled: !data && mode !== EnWordFormModeE.edit },
  ];
};
