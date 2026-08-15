import '../../../../__tests__/helpers/clearDatabaseUrl';

import { describe, expect, it } from '@jest/globals';

import { getVersion } from '../../../../../../../configuration';
import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../../../../types';
import {
  DataSetGrammarPatternT,
  DataSetPhraseT,
  DataSetWordT,
} from '../../../../../../../types/dictionaries/en/EnDataSetTypes';
import { isEmptyValue } from '../isEmptyValue';
import { cleanEntity } from '../cleanEntity';
import { mapWordFromSetToDB } from '../mapWordFromSetToDB';
import { mapPhraseFromSetToDB } from '../mapPhraseFromSetToDB';
import { mapGrammarPatternFromSetToDB } from '../mapGrammarPatternFromSetToDB';

const makeDataSetWord = (extra: Partial<DataSetWordT> = {}): DataSetWordT =>
  ({
    word: 'run',
    part_of_speech: EnPartOfSpeechE.verb,
    area_variant: EnAreaVariantsE.common,
    generated_by_model: 'test-model',
    generated: true,
    verb___phrasal_object_pattern: '',
    verb___transitivity: '',
    language_register: LanguageRegisterE.formal,
    categories: [],
    verb___is_phrasal: false,
    verb___is_irregular: true,
    noun___is_proper: false,
    word_level: WordLevelE.A1,
    description: 'to move fast',
    transcription: 'rʌn',
    is_obsolete: false,
    version: '1.0.0',
    is_abbreviation: false,
    noun___uncountable: false,
    noun___irregular_plural: false,
    noun___always_plural: false,
    base_phrasal: '',
    phrasal_variants: [],
    forms: [
      {
        word: 'ran',
        form_of_word: EnWordFormsE.past_simple,
        transcription: 'ræn',
        area_variant: EnAreaVariantsE.common,
        is_obsolete: false,
      },
    ],
    short_translations: [
      {
        language: AvailableTranslationLanguagesE.ru,
        description: 'бежать',
        variants_of_words: ['бежать'],
      },
    ],
    meanings: [
      {
        title: 'to move fast',
        definition: 'to move fast on foot',
        sort_order: 1,
        examples: [],
        categories: [],
        area_variant: EnAreaVariantsE.common,
        meaning_level: WordLevelE.A1,
        language_register: LanguageRegisterE.formal,
        is_obsolete: false,
        translations: [
          {
            title: 'бежать',
            definition: 'быстро перемещаться',
            variants_of_words: [],
            language: AvailableTranslationLanguagesE.ru,
          },
        ],
      },
    ],
    ...extra,
  }) as DataSetWordT;

const makeDataSetPhrase = (extra: Partial<DataSetPhraseT> = {}): DataSetPhraseT =>
  ({
    phrase: 'in the long run',
    area_variant: EnAreaVariantsE.common,
    generated_by_model: 'test-model',
    generated: false,
    language_register: LanguageRegisterE.formal,
    categories: [],
    level: WordLevelE.B1,
    description: 'eventually',
    transcription: '',
    is_obsolete: false,
    version: '1.0.0',
    short_translations: [],
    meanings: [],
    ...extra,
  }) as DataSetPhraseT;

describe('mapWordFromSetToDB', () => {
  it('maps a dataset word to the DB shape with zeroed ids', () => {
    const res = mapWordFromSetToDB(makeDataSetWord());

    expect(res.id).toBe(0);
    expect(res.word).toBe('run');
    expect(res.part_of_speech).toBe(EnPartOfSpeechE.verb);
    expect(res.form_of_word).toBe(EnWordFormsE.base_form);
    expect(res.pattern).toBeNull();
    expect(res.version).toBe('1.0.0');
    expect(res.forms).toEqual([
      {
        word: 'ran',
        form_of_word: EnWordFormsE.past_simple,
        transcription: 'ræn',
        area_variant: EnAreaVariantsE.common,
        is_obsolete: false,
        id: 0,
      },
    ]);
    expect(res.short_translations[0]).toMatchObject({ id: 0, description: 'бежать' });
    expect(res.meanings[0]).toMatchObject({ id: 0, title: 'to move fast' });
    expect(res.meanings[0].translations[0]).toMatchObject({ id: 0, title: 'бежать' });
  });

  it('fills defaults for empty optional fields', () => {
    const res = mapWordFromSetToDB(
      makeDataSetWord({
        area_variant: '' as unknown as EnAreaVariantsE,
        language_register: '' as unknown as LanguageRegisterE,
        word_level: '',
        verb___transitivity: '',
        verb___phrasal_object_pattern: '',
        categories: undefined,
        version: '',
      } as Partial<DataSetWordT>),
    );

    expect(res.area_variant).toBe(EnAreaVariantsE.common);
    expect(res.language_register).toBe(LanguageRegisterE.formal);
    expect(res.word_level).toBeNull();
    expect(res.verb___transitivity).toBeNull();
    expect(res.verb___phrasal_object_pattern).toBeNull();
    expect(res.categories).toEqual([]);
    expect(res.version).toBe(getVersion());
  });
});

describe('mapPhraseFromSetToDB', () => {
  it('maps a dataset phrase to a phrase word row', () => {
    const res = mapPhraseFromSetToDB(makeDataSetPhrase());

    expect(res.word).toBe('in the long run');
    expect(res.part_of_speech).toBe(EnPartOfSpeechE.phrase);
    expect(res.form_of_word).toBe(EnWordFormsE.base_form);
    expect(res.word_level).toBe(WordLevelE.B1);
    expect(res.pattern).toBeNull();
    expect(res.forms).toEqual([]);
    expect(res.verb___is_phrasal).toBe(false);
    expect(res.is_abbreviation).toBe(false);
  });
});

describe('mapGrammarPatternFromSetToDB', () => {
  it('maps a dataset grammar pattern preserving its pattern list', () => {
    const res = mapGrammarPatternFromSetToDB({
      ...makeDataSetPhrase({ phrase: 'would rather + verb' }),
      pattern: ['would rather', 'verb'],
    } as DataSetGrammarPatternT);

    expect(res.word).toBe('would rather + verb');
    expect(res.part_of_speech).toBe(EnPartOfSpeechE.grammar_pattern);
    expect(res.pattern).toEqual(['would rather', 'verb']);
  });
});

describe('isEmptyValue', () => {
  it('treats null, undefined, blank strings, empty arrays and empty objects as empty', () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue('   ')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue({})).toBe(true);
  });

  it('treats meaningful values as non-empty', () => {
    expect(isEmptyValue('run')).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue([1])).toBe(false);
    expect(isEmptyValue({ a: 1 })).toBe(false);
    expect(isEmptyValue(new Date(0))).toBe(false);
  });
});

describe('cleanEntity', () => {
  it('strips system fields recursively', () => {
    const res = cleanEntity({
      id: 5,
      createdAt: '2026-01-01',
      updateAt: '2026-01-01',
      updatedAt: '2026-01-01',
      word: 'run',
      meanings: [{ id: 7, title: 'to move fast' }],
    });

    expect(res).toEqual({ word: 'run', meanings: [{ title: 'to move fast' }] });
  });

  it('drops empty items from arrays but keeps scalar values as-is', () => {
    expect(cleanEntity(['run', '', null, { id: 1 }])).toEqual(['run']);
    expect(cleanEntity('run')).toBe('run');
    expect(cleanEntity(0)).toBe(0);
    expect(cleanEntity(false)).toBe(false);
  });

  it('keeps Date instances untouched', () => {
    const date = new Date(0);
    expect(cleanEntity({ date })).toEqual({ date });
  });
});
