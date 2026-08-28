import {
  DataSetWordT,
  EnMeaningDST,
  EnMeaningTranslationDST,
  EnShortTranslationDST,
  EnWordFormDST,
  EnWordLinkDST,
} from '../../../../../../types/dictionaries/en/EnDataSetTypes';
import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnAreaVariantsE, EnPartOfSpeechE, EnWordFormsE } from '../../../../../../types';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';
import {
  compareStrings,
  sortFormsForDS,
  sortMeaningTranslationsForDS,
  sortMeaningsForDS,
  sortShortTranslationsForDS,
  sortStrings,
  sortWordLinksForDS,
} from './sortForDataSet';

export const mapMeaningTranslationsForDS = (t: EnMeaningTranslation): EnMeaningTranslationDST => {
  return {
    title: t.title || '',
    variants_of_words: t.variants_of_words || [],
    definition: t.definition || '',
    language: t.language,
  };
};

/**
 * The link stores only the headword, so the exported part of speech is
 * derived: the meaning's own part of speech when the linked word has a
 * base-form entry with it (synonyms and antonyms share it by construction),
 * otherwise the first base form of the linked word; a word loaded without its
 * entries falls back to the meaning's part of speech.
 */
export const mapWordLinkForDS = (entry: EnEntry, partOfSpeech: EnPartOfSpeechE): EnWordLinkDST => {
  const basePos = (entry.entries ?? [])
    .filter((w) => w.form_of_word === EnWordFormsE.base_form)
    .map((w) => w.part_of_speech)
    .sort(compareStrings);
  return {
    word: entry.word,
    part_of_speech: basePos.includes(partOfSpeech) ? partOfSpeech : (basePos[0] ?? partOfSpeech),
  };
};

const mapWordLinksForDS = (entries: EnEntry[] | undefined, partOfSpeech: EnPartOfSpeechE): EnWordLinkDST[] =>
  sortWordLinksForDS((entries ?? []).map((entry) => mapWordLinkForDS(entry, partOfSpeech)));

export const mapMeaningForDS = (m: EnMeaning, partOfSpeech: EnPartOfSpeechE): EnMeaningDST => {
  return {
    title: m.title || '',
    area_variant: m.area_variant || EnAreaVariantsE.common,
    meaning_level: m.meaning_level || '',
    language_register: m.language_register || '',
    is_obsolete: Boolean(m.is_obsolete),
    definition: m.definition || '',
    sort_order: m.sort_order || 0,
    examples: m.examples || [],
    synonyms: mapWordLinksForDS(m.synonyms, partOfSpeech),
    antonyms: mapWordLinksForDS(m.antonyms, partOfSpeech),
    categories: sortStrings(m.categories),
    translations: sortMeaningTranslationsForDS(m.translations.map(mapMeaningTranslationsForDS)),
  };
};

// TypeORM does not guarantee the order of relation rows, so every collection
// is sorted by its natural keys (see sortForDataSet.ts)
export const mapMeaningsForDS = (meanings: EnMeaning[], partOfSpeech: EnPartOfSpeechE): EnMeaningDST[] => {
  return sortMeaningsForDS(meanings.map((m) => mapMeaningForDS(m, partOfSpeech)));
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
    // the column is nullable, the form contract is not: an unmarked form is common
    area_variant: f.area_variant ?? EnAreaVariantsE.common,
    form_of_word: f.form_of_word,
  };
};

export const prepareWordForDataSet = (word: EnWord): DataSetWordT => {
  const { pattern: _p, form_of_word: _f, ...w } = word;
  return {
    categories: sortStrings(w.categories),
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
    phrasal_variants: sortStrings(w.phrasal_variants?.map((v) => v.word.word)),
    meanings: mapMeaningsForDS(w.meanings, w.part_of_speech),
    short_translations: sortShortTranslationsForDS(w.short_translations.map(mapShortTranslationForDS)),
    forms: sortFormsForDS(w.forms.map(mapFormsForDS)),
    version: w.version,
  };
};
