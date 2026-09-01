import en from '../en';
import ru from '../ru';

// The two trees are edited by hand and nothing else enforces their parity
// (issue #353): a key present in one locale and missing in the other only
// surfaces as a MISSING_MESSAGE error at runtime
const flatten = (node: unknown, prefix = ''): string[] =>
  typeof node === 'object' && node !== null
    ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        flatten(value, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

describe('message trees (issue #353)', () => {
  it('en and ru carry exactly the same keys', () => {
    expect(flatten(ru).sort()).toEqual(flatten(en).sort());
  });
});
