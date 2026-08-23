import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnMeaningListItemT,
  EnMeaningTranslationListItemT,
  EnPartOfSpeechE,
  EnWordListItemT,
  WordLevelE,
} from 'server/types';

jest.mock('@/core/api/EnApi', () => ({
  EnApi: { listWords: jest.fn(), listMeanings: jest.fn(), listMeaningTranslations: jest.fn() },
}));

import { EnApi } from '@/core/api/EnApi';
import { SourceKindE } from '../types';
import {
  countActiveFilters,
  emptySource,
  listRecords,
  SOURCE_PLACEHOLDERS,
  toIdentity,
  toLabel,
  toTemplateVars,
} from '../sources';

const word: EnWordListItemT = {
  id: 1,
  word: 'give up',
  part_of_speech: EnPartOfSpeechE.verb,
  area_variant: EnAreaVariantsE.common,
  word_level: null,
  language_register: null,
  generated: false,
  generated_by_model: null,
  version: '1.0.0',
  is_obsolete: false,
  transcription: null,
  description: 'say "no"',
  categories: [],
  meanings_count: 2,
  short_translations_count: 0,
};

const meaning: EnMeaningListItemT = {
  id: 10,
  word_id: 1,
  word: 'give up',
  part_of_speech: EnPartOfSpeechE.verb,
  title: 'stop trying',
  definition: 'to stop doing something',
  sort_order: 0,
  area_variant: EnAreaVariantsE.british,
  meaning_level: WordLevelE.B1,
  language_register: null,
  categories: [],
  is_obsolete: false,
  examples: ['never give up', 'he gave up'],
  synonyms: ['quit', 'surrender'],
  translations_count: 1,
};

const translation: EnMeaningTranslationListItemT = {
  id: 100,
  meaning_id: 10,
  word_id: 1,
  word: 'give up',
  part_of_speech: EnPartOfSpeechE.verb,
  meaning_title: 'stop trying',
  meaning_definition: 'to stop doing something',
  language: AvailableTranslationLanguagesE.ru,
  title: 'сдаваться',
  definition: 'перестать пытаться',
  variants_of_words: ['сдаться'],
};

describe('sources', () => {
  it('exposes exactly the placeholders of each table as template variables', () => {
    expect(Object.keys(toTemplateVars(SourceKindE.words, word))).toEqual(
      SOURCE_PLACEHOLDERS[SourceKindE.words],
    );
    expect(toTemplateVars(SourceKindE.words, word)).toMatchObject({
      word: 'give up',
      part_of_speech: 'verb',
      description: 'say "no"',
      // nulls render as empty strings
      word_level: '',
    });
    // the word identity plus the meaning columns
    expect(toTemplateVars(SourceKindE.meanings, meaning)).toEqual({
      word: 'give up',
      part_of_speech: 'verb',
      title: 'stop trying',
      definition: 'to stop doing something',
      examples: ['never give up', 'he gave up'],
      synonyms: ['quit', 'surrender'],
      area_variant: 'british',
      meaning_level: 'B1',
      language_register: '',
      categories: [],
      sort_order: 0,
      is_obsolete: false,
    });
    // the word identity, the translation columns and the meaning it translates
    expect(toTemplateVars(SourceKindE.translations, translation)).toEqual({
      word: 'give up',
      part_of_speech: 'verb',
      language: 'ru',
      title: 'сдаваться',
      definition: 'перестать пытаться',
      variants_of_words: ['сдаться'],
      meaning_title: 'stop trying',
      meaning_definition: 'to stop doing something',
    });
  });

  it('opens every output line with the ids needed to trace the row', () => {
    expect(toIdentity(SourceKindE.words, word)).toEqual({ word: 'give up', part_of_speech: 'verb' });
    expect(toIdentity(SourceKindE.meanings, meaning)).toEqual({
      word: 'give up',
      part_of_speech: 'verb',
      meaning_id: 10,
    });
    expect(toIdentity(SourceKindE.translations, translation)).toEqual({
      word: 'give up',
      part_of_speech: 'verb',
      meaning_id: 10,
      translation_id: 100,
      language: 'ru',
    });
  });

  it('labels rows by word or by title', () => {
    expect(toLabel(SourceKindE.words, word)).toBe('give up');
    expect(toLabel(SourceKindE.meanings, meaning)).toBe('stop trying');
    expect(toLabel(SourceKindE.translations, translation)).toBe('сдаваться');
  });

  it('lists each table through its own endpoint with the filter and the page', async () => {
    await listRecords({ kind: SourceKindE.words, filter: { search: 'a' } }, 2, 50);
    expect(EnApi.listWords).toHaveBeenCalledWith({ search: 'a', page: 2, limit: 50 });

    await listRecords({ kind: SourceKindE.meanings, filter: { has_translations: false } }, 1, 200);
    expect(EnApi.listMeanings).toHaveBeenCalledWith({ has_translations: false, page: 1, limit: 200 });

    await listRecords(emptySource(SourceKindE.translations), 1, 50);
    expect(EnApi.listMeaningTranslations).toHaveBeenCalledWith({ page: 1, limit: 50 });
  });

  it('counts the filters that are set', () => {
    expect(countActiveFilters(emptySource(SourceKindE.words))).toBe(0);
    expect(
      countActiveFilters({
        kind: SourceKindE.words,
        filter: { search: 'a', part_of_speech: [], generated: false, version: undefined },
      }),
    ).toBe(2);
  });
});
