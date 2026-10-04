import { describe, expect, it } from '@jest/globals';
import { normalizeWordLinks } from '../normalizeWordLinks';
import { prepareMeaningFromDB } from '../prepareMeaningFromDB';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnEntry } from '../../entities/en_entry.entity';
import { EnAreaVariantsE } from '../../../../../types';

describe('normalizeWordLinks (issues #259, #266)', () => {
  it('preserves the case of imported and stored headwords', () => {
    expect(normalizeWordLinks([' Polish ', 'polish', 'Polish', '', 'Northstar'])).toEqual([
      'Northstar',
      'Polish',
      'polish',
    ]);
    expect(normalizeWordLinks(['Polish', 'polish'], 'Polish')).toEqual(['polish']);
  });
  it('trims, drops blanks and exact duplicates and sorts the result', () => {
    expect(normalizeWordLinks([' Quick ', 'fast', 'Quick', '', '  ', 'rapid'])).toEqual([
      'Quick',
      'fast',
      'rapid',
    ]);
  });

  it('drops the exact headword regardless of spacing', () => {
    expect(normalizeWordLinks(['Bright', 'clever', 'Bright '], ' Bright')).toEqual(['clever']);
  });

  it('returns an empty list for null and undefined', () => {
    expect(normalizeWordLinks(null)).toEqual([]);
    expect(normalizeWordLinks(undefined)).toEqual([]);
  });

  it('compares by UTF-16 code units, never by locale', () => {
    expect(normalizeWordLinks(['b', 'B', 'a'])).toEqual(['B', 'a', 'b']);
    expect(normalizeWordLinks(['é', 'z'])).toEqual(['z', 'é']);
  });
});

describe('prepareMeaningFromDB (issue #259)', () => {
  const row = (synonyms?: EnEntry[], antonyms?: EnEntry[]): EnMeaning =>
    ({
      id: 1,
      createdAt: new Date(),
      updateAt: new Date(),
      word: { id: 5 },
      title: 'shining',
      definition: 'giving out much light',
      sort_order: 1,
      is_obsolete: false,
      area_variant: EnAreaVariantsE.common,
      examples: ['a bright light'],
      translations: [],
      synonyms,
      antonyms,
    }) as unknown as EnMeaning;

  it('maps the entry links to sorted headwords and strips the system fields', () => {
    const res = prepareMeaningFromDB(row([{ word: 'vivid' }, { word: 'luminous' }] as EnEntry[]));
    expect(res.synonyms).toEqual(['luminous', 'vivid']);
    expect(res).not.toHaveProperty('createdAt');
    expect(res).not.toHaveProperty('updateAt');
    expect(res).not.toHaveProperty('word');
    expect(res.title).toBe('shining');
  });

  it('retains exact spellings in both kinds of stored links', () => {
    const res = prepareMeaningFromDB(
      row([{ word: 'Polish' }, { word: 'polish' }] as EnEntry[], [{ word: 'Northstar' }] as EnEntry[]),
    );
    expect(res.synonyms).toEqual(['Polish', 'polish']);
    expect(res.antonyms).toEqual(['Northstar']);
  });

  it('yields an empty list when the relation was not loaded', () => {
    expect(prepareMeaningFromDB(row(undefined)).synonyms).toEqual([]);
    expect(prepareMeaningFromDB(row(undefined)).antonyms).toEqual([]);
  });

  it('maps the antonym links the same way (issue #266)', () => {
    const res = prepareMeaningFromDB(
      row([{ word: 'vivid' }] as EnEntry[], [{ word: 'dull' }, { word: 'dim' }] as EnEntry[]),
    );
    expect(res.synonyms).toEqual(['vivid']);
    expect(res.antonyms).toEqual(['dim', 'dull']);
  });
});
