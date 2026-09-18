import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

import ar from '../ar';
import de from '../de';
import en from '../en';
import es from '../es';
import fr from '../fr';
import pt from '../pt';
import ru from '../ru';
import zh from '../zh';

// The trees are edited by hand and nothing else enforces their parity
// (issue #353): a key present in one locale and missing in another only
// surfaces as a MISSING_MESSAGE error at runtime. One catalog per member of
// InterfaceLanguageEnum (issues #450, #463, #464)
const CATALOGS = { en, ru, es, fr, pt, de, zh, ar } as const;

const flatten = (node: unknown, prefix = ''): Array<[string, string]> =>
  typeof node === 'object' && node !== null
    ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        flatten(value, prefix ? `${prefix}.${key}` : key),
      )
    : [[prefix, String(node)]];

const keysOf = (tree: unknown): string[] =>
  flatten(tree)
    .map(([key]) => key)
    .sort();

describe('message trees (issue #353)', () => {
  it.each(Object.entries(CATALOGS).filter(([locale]) => locale !== 'en'))(
    '%s carries exactly the keys of en',
    (_locale, tree) => {
      expect(keysOf(tree)).toEqual(keysOf(en));
    },
  );

  // next-intl treats every message as an ICU pattern: an unquoted literal
  // "{ data, meta }" is parsed as an argument and blows up at render time
  // (INVALID_MESSAGE) — literal braces must be quoted as '{ ... }'
  it.each(Object.entries(CATALOGS))('every %s message parses as ICU', (_locale, tree) => {
    for (const [key, message] of flatten(tree)) {
      try {
        parse(message);
      } catch (error) {
        throw new Error(`"${key}" is not valid ICU: ${(error as Error).message}`, { cause: error });
      }
    }
  });

  // a translation must keep the arguments of the English message: a
  // placeholder renamed or dropped renders as text or throws at runtime
  it.each(Object.entries(CATALOGS).filter(([locale]) => locale !== 'en'))(
    'every %s message keeps the ICU arguments of en',
    (_locale, tree) => {
      const argumentsOf = (message: string) =>
        [...message.matchAll(/\{\s*([a-zA-Z0-9_]+)/g)].map((m) => m[1]).sort();
      const english = new Map(flatten(en));
      for (const [key, message] of flatten(tree)) {
        expect({ key, args: argumentsOf(message) }).toEqual({ key, args: argumentsOf(english.get(key) ?? '') });
      }
    },
  );

  // A plural message must carry the categories of its locale (issue #464):
  // English gets by with `one` / `other`, Arabic needs all six, and a missing
  // category falls back to `other` silently at runtime
  it.each(Object.entries(CATALOGS))('every %s plural carries the categories of its locale', (locale, tree) => {
    const required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    const pluralCategories = (elements: MessageFormatElement[]): string[][] =>
      elements.flatMap((element) => {
        if (element.type !== TYPE.plural) return [];
        const own = Object.keys(element.options).filter((key) => !key.startsWith('='));
        return [own, ...Object.values(element.options).flatMap((option) => pluralCategories(option.value))];
      });
    for (const [key, message] of flatten(tree)) {
      for (const categories of pluralCategories(parse(message))) {
        expect({ key, categories: categories.sort() }).toEqual({ key, categories: [...required].sort() });
      }
    }
  });
});
