import '../../../../__tests__/helpers/clearDatabaseUrl';

import { describe, expect, it } from '@jest/globals';

import {
  compareBy,
  compareExportLineKeys,
  compareStrings,
  sortFormsForDS,
  sortMeaningTranslationsForDS,
  sortMeaningsForDS,
  sortShortTranslationsForDS,
  sortStrings,
} from '../sortForDataSet';
import {
  EnMeaningDST,
  EnMeaningTranslationDST,
  EnShortTranslationDST,
  EnWordFormDST,
} from '../../../../../../../types/dictionaries/en/EnDataSetTypes';
import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
} from '../../../../../../../types';

const meaning = (extra: Partial<EnMeaningDST>): EnMeaningDST => ({
  title: '',
  area_variant: EnAreaVariantsE.common,
  meaning_level: '',
  language_register: '',
  is_obsolete: false,
  definition: '',
  sort_order: 0,
  examples: [],
  synonyms: [],
  categories: [],
  translations: [],
  ...extra,
});

describe('compareStrings', () => {
  it('orders by code units without locale collation', () => {
    // uppercase letters sort before lowercase ones in code-unit order
    expect(['b', 'a', 'B', 'A'].sort(compareStrings)).toEqual(['A', 'B', 'a', 'b']);
    // non-latin scripts and spaces are handled consistently as well
    expect(['give up', 'give', 'бежать', 'Ёж'].sort(compareStrings)).toEqual([
      'give',
      'give up',
      'Ёж',
      'бежать',
    ]);
  });
});

describe('compareBy', () => {
  it('compares by the keys in order, numbers numerically', () => {
    const items = [
      { n: 10, s: 'b' },
      { n: 2, s: 'a' },
      { n: 2, s: 'b' },
    ];
    const sorted = [...items].sort(
      compareBy(
        (i) => i.n,
        (i) => i.s,
      ),
    );
    expect(sorted).toEqual([
      { n: 2, s: 'a' },
      { n: 2, s: 'b' },
      { n: 10, s: 'b' },
    ]);
  });

  it('falls back to the serialized form when every key is equal, so the order is total', () => {
    const a = { k: 'x', extra: 'a' };
    const b = { k: 'x', extra: 'b' };
    const cmp = compareBy<{ k: string; extra: string }>((i) => i.k);
    expect([b, a].sort(cmp)).toEqual([a, b]);
    expect([a, b].sort(cmp)).toEqual([a, b]);
  });

  it('treats null and undefined keys as empty strings', () => {
    const cmp = compareBy<{ v: string | null | undefined }>((i) => i.v);
    // null, undefined and '' are the same key, so 'a' is the only item the key itself can order
    const sorted = [{ v: 'a' }, { v: null }, { v: undefined }, { v: '' }].sort(cmp).map((i) => i.v);
    expect(sorted[3]).toBe('a');
    expect(sorted.slice(0, 3)).toEqual(expect.arrayContaining([null, undefined, '']));
  });
});

describe('sortStrings', () => {
  it('returns a sorted copy and tolerates missing input', () => {
    const input = ['c', 'a', 'b'];
    expect(sortStrings(input)).toEqual(['a', 'b', 'c']);
    expect(input).toEqual(['c', 'a', 'b']);
    expect(sortStrings(undefined)).toEqual([]);
    expect(sortStrings(null)).toEqual([]);
  });
});

describe('sortMeaningsForDS', () => {
  it('sorts by sort_order, then title, then definition, then area_variant', () => {
    const sorted = sortMeaningsForDS([
      meaning({ sort_order: 2, title: 'a' }),
      meaning({ sort_order: 1, title: 'b', definition: 'z' }),
      meaning({ sort_order: 1, title: 'b', definition: 'y', area_variant: EnAreaVariantsE.american }),
      meaning({ sort_order: 1, title: 'b', definition: 'y', area_variant: EnAreaVariantsE.common }),
      meaning({ sort_order: 1, title: 'a' }),
    ]);
    expect(sorted.map((m) => [m.sort_order, m.title, m.definition, m.area_variant])).toEqual([
      [1, 'a', '', EnAreaVariantsE.common],
      [1, 'b', 'y', EnAreaVariantsE.american],
      [1, 'b', 'y', EnAreaVariantsE.common],
      [1, 'b', 'z', EnAreaVariantsE.common],
      [2, 'a', '', EnAreaVariantsE.common],
    ]);
  });
});

describe('sortMeaningTranslationsForDS / sortShortTranslationsForDS', () => {
  it('sorts meaning translations by language, title, definition', () => {
    const tr = (title: string, definition = ''): EnMeaningTranslationDST => ({
      language: AvailableTranslationLanguagesE.ru,
      title,
      definition,
      variants_of_words: [],
    });
    expect(
      sortMeaningTranslationsForDS([tr('б'), tr('а', '2'), tr('а', '1')]).map((t) => t.title + t.definition),
    ).toEqual(['а1', 'а2', 'б']);
  });

  it('sorts short translations by language, description', () => {
    const st = (description: string): EnShortTranslationDST => ({
      language: AvailableTranslationLanguagesE.ru,
      description,
      variants_of_words: [],
    });
    expect(sortShortTranslationsForDS([st('в'), st('а'), st('б')]).map((t) => t.description)).toEqual([
      'а',
      'б',
      'в',
    ]);
  });
});

describe('sortFormsForDS', () => {
  it('sorts by form_of_word, then word, then area_variant', () => {
    const form = (
      form_of_word: EnWordFormsE,
      word: string,
      area_variant = EnAreaVariantsE.common,
    ): EnWordFormDST => ({
      form_of_word,
      word,
      area_variant,
      transcription: '',
      is_obsolete: false,
    });
    const sorted = sortFormsForDS([
      form(EnWordFormsE.third_person_singular, 'runs'),
      form(EnWordFormsE.past_simple, 'ran', EnAreaVariantsE.american),
      form(EnWordFormsE.past_simple, 'ran', EnAreaVariantsE.common),
      form(EnWordFormsE.past_simple, 'r'),
    ]);
    expect(sorted.map((f) => `${f.form_of_word}:${f.word}:${f.area_variant}`)).toEqual([
      `${EnWordFormsE.past_simple}:r:${EnAreaVariantsE.common}`,
      `${EnWordFormsE.past_simple}:ran:${EnAreaVariantsE.american}`,
      `${EnWordFormsE.past_simple}:ran:${EnAreaVariantsE.common}`,
      `${EnWordFormsE.third_person_singular}:runs:${EnAreaVariantsE.common}`,
    ]);
  });
});

describe('compareExportLineKeys', () => {
  it('orders lines by word, part of speech, area variant and only then by id', () => {
    const keys = [
      { id: 1, word: 'run', part_of_speech: EnPartOfSpeechE.verb, area_variant: EnAreaVariantsE.common },
      { id: 2, word: 'run', part_of_speech: EnPartOfSpeechE.noun, area_variant: EnAreaVariantsE.common },
      { id: 3, word: 'give', part_of_speech: EnPartOfSpeechE.verb, area_variant: EnAreaVariantsE.american },
      { id: 4, word: 'give', part_of_speech: EnPartOfSpeechE.verb, area_variant: null },
      { id: 6, word: 'give', part_of_speech: EnPartOfSpeechE.verb, area_variant: EnAreaVariantsE.common },
      { id: 5, word: 'give', part_of_speech: EnPartOfSpeechE.verb, area_variant: EnAreaVariantsE.common },
    ];
    expect([...keys].sort(compareExportLineKeys).map((k) => k.id)).toEqual([4, 3, 5, 6, 2, 1]);
  });
});
