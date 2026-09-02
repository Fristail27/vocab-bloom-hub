import { parse } from '@formatjs/icu-messageformat-parser';

import en from '../en';
import ru from '../ru';

// The two trees are edited by hand and nothing else enforces their parity
// (issue #353): a key present in one locale and missing in the other only
// surfaces as a MISSING_MESSAGE error at runtime
const flatten = (node: unknown, prefix = ''): Array<[string, string]> =>
  typeof node === 'object' && node !== null
    ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        flatten(value, prefix ? `${prefix}.${key}` : key),
      )
    : [[prefix, String(node)]];

describe('message trees (issue #353)', () => {
  it('en and ru carry exactly the same keys', () => {
    expect(
      flatten(ru)
        .map(([key]) => key)
        .sort(),
    ).toEqual(
      flatten(en)
        .map(([key]) => key)
        .sort(),
    );
  });

  // next-intl treats every message as an ICU pattern: an unquoted literal
  // "{ data, meta }" is parsed as an argument and blows up at render time
  // (INVALID_MESSAGE) — literal braces must be quoted as '{ ... }'
  it.each([
    ['en', en],
    ['ru', ru],
  ])('every %s message parses as ICU', (_locale, tree) => {
    for (const [key, message] of flatten(tree)) {
      try {
        parse(message);
      } catch (error) {
        throw new Error(`"${key}" is not valid ICU: ${(error as Error).message}`, { cause: error });
      }
    }
  });
});
