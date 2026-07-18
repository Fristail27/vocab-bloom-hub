import {
  DataSetWordT,
  EnMeaningDST,
  EnMeaningTranslationDST,
  EnShortTranslationDST,
  EnWordFormDST,
} from '../../../../../../types/dictionaries/en/EnDataSetTypes';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnAreaVariantsE } from '../../../../../../types';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';

export const mapMeaningTranslationsForDS = (t: EnMeaningTranslation): EnMeaningTranslationDST => {
  return {
    title: t.title || '',
    variants_of_words: t.variants_of_words || [],
    definition: t.definition || '',
    language: t.language,
  };
};

export const mapMeaningForDS = (m: EnMeaning): EnMeaningDST => {
  return {
    title: m.title || '',
    area_variant: m.area_variant || EnAreaVariantsE.common,
    meaning_level: m.meaning_level || '',
    language_register: m.language_register || '',
    is_obsolete: Boolean(m.is_obsolete),
    definition: m.definition || '',
    sort_order: m.sort_order || 0,
    examples: m.examples || [],
    categories: m.categories || [],
    translations: m.translations.map(mapMeaningTranslationsForDS),
  };
};

export const mapShortTranslationForDS = (t: EnShortTranslation): EnShortTranslationDST => {
  return {
    language: t.language,
    variants_of_words: t.variants_of_words || [],
    description: t.description || '',
  };
};

export const mapFormsForDS = (f: EnWord): EnWordFormDST => {
  return {
    is_obsolete: !!f.is_obsolete,
    transcription: f.transcription || '',
    word: f.word.word,
    area_variant: f.area_variant,
    form_of_word: f.form_of_word,
  };
};

export const prepareWordForDataSet = (word: EnWord): DataSetWordT => {
  const { pattern: _p, form_of_word: _f, ...w } = word;
  return {
    categories: w.categories || [],
    generated: Boolean(w.generated),
    generated_by_model: w.generated_by_model || '',
    transcription: w.transcription || '',
    area_variant: w.area_variant || '',
    part_of_speech: w.part_of_speech,
    description: w.description || '',
    language_register: w.language_register || '',
    word_level: w.word_level || '',
    noun___is_proper: Boolean(w.noun___is_proper),
    is_abbreviation: Boolean(w.is_abbreviation),
    verb___is_irregular: Boolean(w.verb___is_irregular),
    verb___is_phrasal: Boolean(w.verb___is_phrasal),
    verb___transitivity: w.verb___transitivity || '',
    verb___phrasal_object_pattern: w.verb___phrasal_object_pattern || '',
    noun___uncountable: Boolean(w.noun___uncountable),
    is_obsolete: Boolean(w.is_obsolete),
    noun___always_plural: Boolean(w.noun___always_plural),
    noun___irregular_plural: Boolean(w.noun___irregular_plural),
    word: w.word.word,
    base_phrasal: w.base_phrasal?.word.word || '',
    phrasal_variants: w.phrasal_variants?.map((v) => v.word.word) || [],
    meanings: w.meanings.map(mapMeaningForDS) || [],
    short_translations: w.short_translations.map(mapShortTranslationForDS) || [],
    forms: w.forms.map(mapFormsForDS) || [],
  };
};
