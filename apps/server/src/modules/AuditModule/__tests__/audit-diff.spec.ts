import { diffSnapshots, snapshotScalars } from '../audit-diff';

describe('audit snapshots and diffs (issue #334)', () => {
  it('keeps primitives, arrays of primitives and dates; reduces relations to word or id', () => {
    const entity = {
      id: 5,
      word: { word: 'run', id: 1 },
      base_form: { id: 3 },
      categories: ['IT', 'sport'],
      is_obsolete: false,
      transcription: null,
      createdAt: new Date('2026-08-30T10:00:00.000Z'),
      synonyms: [{ word: 'sprint', id: 9 }],
      save: () => undefined,
    };

    expect(snapshotScalars(entity)).toEqual({
      id: 5,
      word: 'run',
      base_form: 3,
      categories: ['IT', 'sport'],
      is_obsolete: false,
      transcription: null,
      createdAt: '2026-08-30T10:00:00.000Z',
      synonyms: ['sprint'],
    });
  });

  it('diffs only the fields that changed, undefined and null treated alike', () => {
    const before = { level: 'A1', categories: ['IT'], description: undefined };
    const after = { level: 'B2', categories: ['IT'], description: null };

    expect(diffSnapshots(before, after)).toEqual({ level: { before: 'A1', after: 'B2' } });
  });

  it('sees array and appearing/disappearing changes', () => {
    expect(diffSnapshots({ categories: ['IT'] }, { categories: ['IT', 'sport'] })).toEqual({
      categories: { before: ['IT'], after: ['IT', 'sport'] },
    });
    expect(diffSnapshots({}, { word_level: 'A1' })).toEqual({ word_level: { before: null, after: 'A1' } });
    expect(diffSnapshots({ word_level: 'A1' }, {})).toEqual({ word_level: { before: 'A1', after: null } });
  });

  it('is null when nothing changed — no empty audit rows', () => {
    expect(diffSnapshots({ a: 1, b: ['x'] }, { a: 1, b: ['x'] })).toBeNull();
  });
});
