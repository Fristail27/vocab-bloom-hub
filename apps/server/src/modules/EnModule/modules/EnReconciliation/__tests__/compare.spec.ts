import { compare, contentHash, equalSides, missing, present, resolve } from '../compare';

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

it('requires a decision when changed source records cannot be paired by a stable identity', () => {
  const old = '11111111-1111-4111-8111-111111111111';
  const next = '22222222-2222-4222-8222-222222222222';
  const base = present({ meanings: { [old]: { definition: 'before' } } });
  const result = compare(base, base, present({ meanings: { [next]: { definition: 'after' } } }));
  expect(result.conflicts).toEqual([expect.objectContaining({ path: ['meanings'], kind: 'identity' })]);
});
