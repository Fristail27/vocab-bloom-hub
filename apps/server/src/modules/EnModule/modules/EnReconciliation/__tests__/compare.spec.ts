import { compare, contentHash, equalSides, equalContentSides, missing, present, resolve } from '../compare';

describe('three-way reconciliation', () => {
  const base = present({ definition: 'old', translations: { ru: 'старый' }, examples: [] });

  it('combines independent field edits and retains exact conflict locations', () => {
    const local = present({ definition: 'local', translations: { ru: 'старый' }, examples: [] });
    const incoming = present({ definition: 'source', translations: { ru: 'новый' }, examples: ['example'] });
    const plan = compare(base, local, incoming);
    expect(plan.category).toBe('conflicts');
    expect(plan.conflicts).toEqual([
      {
        path: ['definition'],
        baseline: present('old'),
        local: present('local'),
        incoming: present('source'),
        kind: 'edit',
      },
    ]);
    expect(resolve(plan, [{ path: ['definition'], choice: 'local' }])).toEqual({
      remaining: 0,
      result: present({ definition: 'local', translations: { ru: 'новый' }, examples: ['example'] }),
    });
  });

  it('combines edits to different stable records, including a deletion and an addition', () => {
    const before = present({ meanings: { a: { definition: 'A' }, b: { definition: 'B' } } });
    const local = present({ meanings: { a: { definition: 'local A' } } });
    const incoming = present({
      meanings: { a: { definition: 'A' }, b: { definition: 'B' }, c: { definition: 'C' } },
    });
    expect(compare(before, local, incoming)).toEqual({
      category: 'changed',
      conflicts: [],
      result: present({ meanings: { a: { definition: 'local A' }, c: { definition: 'C' } } }),
    });
  });

  it.each([
    [missing, missing, present('new'), 'added', present('new')],
    [present('old'), present('old'), missing, 'deleted', missing],
    [present('old'), missing, present('old'), 'local_only', missing],
    [present('old'), present('local'), present('old'), 'local_only', present('local')],
    [present('old'), present('new'), present('new'), 'local_only', present('new')],
    [present('old'), present('old'), present('old'), 'unchanged', present('old')],
  ])('classifies changes without double-counting', (baseline, local, incoming, category, result) => {
    expect(compare(baseline, local, incoming)).toEqual({ category, result, conflicts: [] });
  });

  it.each([
    [present('old'), missing, present('new'), 'delete'],
    [present('old'), present('new'), missing, 'delete'],
    [missing, present({ title: 'ours' }), present({ title: 'theirs' }), 'add'],
  ])('does not silently resolve incompatible additions or edit/delete', (baseline, local, incoming, kind) => {
    const result = compare(baseline, local, incoming);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].kind).toBe(kind);
  });

  it('preserves all local content absent from a partial input', () => {
    expect(compare(base, base, missing, { complete: false })).toEqual({
      result: base,
      category: 'unchanged',
      conflicts: [],
    });
  });

  it('requires explicit review without an ancestor, including incoming-only fields', () => {
    const result = compare(
      missing,
      present({ same: 1, title: 'local' }),
      present({ same: 1, title: 'source', extra: 2 }),
      { baselineKnown: false },
    );
    expect(result.conflicts.map((conflict) => [conflict.path, conflict.kind])).toEqual([
      [['extra'], 'baseline_missing'],
      [['title'], 'baseline_missing'],
    ]);
  });

  it('does not merge ordered arrays or ambiguously identified records by index', () => {
    const result = compare(present(['A', 'B']), present(['B', 'A']), present(['A', 'C']));
    expect(result.conflicts).toHaveLength(1);
  });

  it('distinguishes absent, null, false, empty text and empty arrays', () => {
    const values = [missing, present(null), present(false), present(''), present([])];
    for (const [i, a] of values.entries())
      for (const [j, b] of values.entries()) expect(equalSides(a, b)).toBe(i === j);
  });

  it('supports a custom result and explicit deletion without mutating the saved comparison', () => {
    const plan = compare(
      present({ a: 'base', b: 'base' }),
      present({ a: 'local', b: 'local' }),
      present({ a: 'incoming', b: 'incoming' }),
    );
    expect(
      resolve(plan, [
        { path: ['a'], choice: 'custom', result: present('edited') },
        { path: ['b'], choice: 'custom', result: missing },
      ]),
    ).toEqual({ remaining: 0, result: present({ a: 'edited' }) });
    expect(plan.result).toEqual(present({ a: 'local', b: 'local' }));
    expect(resolve(plan, []).remaining).toBe(2);
  });

  it('rejects stale, duplicate and incomplete decisions', () => {
    const plan = compare(present('base'), present('local'), present('incoming'));
    expect(() => resolve(plan, [{ path: ['wrong'], choice: 'local' }])).toThrow('outdated');
    expect(() =>
      resolve(plan, [
        { path: [], choice: 'local' },
        { path: [], choice: 'incoming' },
      ]),
    ).toThrow('outdated');
    expect(() => resolve(plan, [{ path: [], choice: 'custom' }])).toThrow('invalid');
  });

  it('remembers rejected incoming edits when that incoming snapshot becomes the next baseline', () => {
    const local = present({ title: 'ours', definition: 'old' });
    const incoming = present({ title: 'theirs', definition: 'old' });
    const next = present({ title: 'theirs', definition: 'new' });
    expect(compare(incoming, local, incoming).conflicts).toEqual([]);
    expect(compare(incoming, local, next)).toEqual({
      result: present({ title: 'ours', definition: 'new' }),
      conflicts: [],
      category: 'changed',
    });
  });

  it('hashes object keys canonically without ignoring array order', () => {
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
    expect(contentHash(['a', 'b'])).not.toBe(contentHash(['b', 'a']));
  });

  it('treats imported prototype-like names as data', () => {
    const base = present(JSON.parse('{"__proto__":"base"}'));
    const local = present(JSON.parse('{"__proto__":"local"}'));
    const incoming = present(JSON.parse('{"__proto__":{"polluted":true}}'));
    expect(
      resolve(compare(base, local, incoming), [{ path: ['__proto__'], choice: 'incoming' }]).result,
    ).toEqual(incoming);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('source terms versus acquisition bookkeeping', () => {
  const origin = {
    id: 'source-id',
    name: 'Example glossary',
    version: '2.4',
    licenses: [{ spdx: 'CC0-1.0', name: 'CC0', url: 'https://example.org/license' }],
    license_relation: 'all',
    attribution: 'Example editors',
    notices: ['Keep attribution'],
    scope: 'word',
    method: 'dataset',
    recorded_at: null,
    inherited: true,
  };
  const acquired = {
    ...origin,
    id: 'local-source-id',
    method: 'manual',
    recorded_at: '2026-10-04T18:59:56.630Z',
    inherited: false,
    acquisitions: [
      {
        id: '58b727a8-296a-4278-87be-345e4a8a7dc6',
        method: 'fork',
        recorded_at: '2026-10-04T18:59:56.630Z',
        revision: '19756:19756:',
      },
    ],
  };
  const article = (description: string, source: Parameters<typeof present>[0] = origin) =>
    present({ parts: { noun: { common: { description, origins: [source] } } } });

  it('leaves only the edited description in a conflict and keeps the complete local acquisition', () => {
    const local = article('local text', acquired);
    const result = compare(article('before'), local, article('incoming text'));
    expect(result.conflicts.map((conflict) => conflict.path)).toEqual([
      ['parts', 'noun', 'common', 'description'],
    ]);
    expect(
      resolve(result, [{ path: ['parts', 'noun', 'common', 'description'], choice: 'incoming' }]).result,
    ).toEqual(article('incoming text', acquired));
  });

  it('does not report acquisition differences as changes, including without a common baseline', () => {
    const original = article('same');
    const fork = article('same', acquired);
    expect(compare(original, fork, original)).toEqual({ category: 'unchanged', result: fork, conflicts: [] });
    expect(compare(missing, fork, original, { baselineKnown: false }).conflicts).toEqual([]);
    expect(equalContentSides(original, fork)).toBe(true);
    expect(equalSides(original, fork)).toBe(false);
    expect(contentHash(JSON.parse(JSON.stringify(original)))).not.toBe(
      contentHash(JSON.parse(JSON.stringify(fork))),
    );
  });

  it('allows deletion of an unchanged fork word but retains a conflict for a real local edit', () => {
    expect(compare(article('before'), article('before', acquired), missing)).toMatchObject({
      category: 'deleted',
      result: missing,
    });
    expect(compare(article('before'), article('local edit', acquired), missing).conflicts[0].kind).toBe(
      'delete',
    );
  });

  it.each([
    { version: '3.0' },
    { attribution: 'Other editors' },
    { notices: ['New notice'] },
    { licenses: [{ spdx: 'CC-BY-4.0', name: 'Attribution', url: 'https://example.org/new-license' }] },
    { license_relation: 'any' },
    { name: 'Another source' },
  ])('still reviews a real change of source terms: %j', (change) => {
    const result = compare(missing, article('same', acquired), article('same', { ...origin, ...change }), {
      baselineKnown: false,
    });
    expect(result.conflicts.map((conflict) => conflict.path)).toEqual([['parts', 'noun', 'common', 'origins']]);
  });

  it('does not ignore fields with similar names outside source bookkeeping', () => {
    expect(
      compare(present({ id: 'base' }), present({ id: 'local' }), present({ id: 'incoming' })).conflicts[0].path,
    ).toEqual(['id']);
  });
});

it('requires a decision when changed source records cannot be paired by a stable identity', () => {
  const old = '11111111-1111-4111-8111-111111111111';
  const next = '22222222-2222-4222-8222-222222222222';
  const base = present({ meanings: { [old]: { definition: 'before' } } });
  const result = compare(base, base, present({ meanings: { [next]: { definition: 'after' } } }));
  expect(result.conflicts).toEqual([expect.objectContaining({ path: ['meanings'], kind: 'identity' })]);
});
