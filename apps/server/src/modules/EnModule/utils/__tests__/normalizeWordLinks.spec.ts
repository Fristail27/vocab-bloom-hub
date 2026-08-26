import { describe, expect, it } from '@jest/globals';
import { normalizeWordLinks } from '../normalizeWordLinks';
import { prepareMeaningFromDB } from '../prepareMeaningFromDB';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnEntry } from '../../entities/en_entry.entity';
import { EnAreaVariantsE } from '../../../../../types';

describe('normalizeWordLinks (issues #259, #266)', () => {
  it('trims, lowercases, drops blanks and duplicates and sorts the result', () => {
    expect(normalizeWordLinks([' Quick ', 'fast', 'QUICK', '', '  ', 'rapid'])).toEqual([
      'fast',
      'quick',
      'rapid',
    ]);
  });

  it('drops the headword itself regardless of case and spacing', () => {
    expect(normalizeWordLinks(['Bright', 'clever', 'bright '], ' BRIGHT')).toEqual(['clever']);
  });

  it('returns an empty list for null and undefined', () => {
    expect(normalizeWordLinks(null)).toEqual([]);
    expect(normalizeWordLinks(undefined)).toEqual([]);
  });

  it('compares by UTF-16 code units, never by locale', () => {
    expect(normalizeWordLinks(['b', 'B', 'a'])).toEqual(['a', 'b']);
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
