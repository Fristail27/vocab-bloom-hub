import type { PublicWordV1T } from 'server/types';

import { leadDefinition, localeFirst, localeTranslations, translationLanguages } from '../wordPage';

const entry = (overrides: Partial<PublicWordV1T>): PublicWordV1T =>
  ({ meanings: [], short_translations: [], description: null, ...overrides }) as PublicWordV1T;

const short = (language: string, description: string) =>
  ({ id: 1, language, description, variants_of_words: [] }) as PublicWordV1T['short_translations'][number];

describe('localeTranslations', () => {
  const entries = [
    entry({ short_translations: [short('es', 'flor'), short('ru', 'цветок'), short('ru', 'Цветок ')] }),
    entry({ short_translations: [short('ru', 'цветение'), short('ru', '')] }),
  ];

  it('collects the translations of the locale across the entries, in order, without repeats', () => {
    expect(localeTranslations(entries, 'ru')).toEqual(['цветок', 'цветение']);
    expect(localeTranslations(entries, 'es')).toEqual(['flor']);
  });

  it('answers nothing for English, the language of the headwords, and for a locale without translations', () => {
    expect(localeTranslations(entries, 'en')).toEqual([]);
    expect(localeTranslations(entries, 'de')).toEqual([]);
  });
});

describe('localeFirst', () => {
  it('moves the items of the locale to the front and keeps the order otherwise', () => {
    const items = [short('es', 'a'), short('ru', 'b'), short('fr', 'c'), short('ru', 'd')];
    expect(localeFirst(items, 'ru').map((item) => item.description)).toEqual(['b', 'd', 'a', 'c']);
    expect(localeFirst(items, 'en').map((item) => item.description)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('leadDefinition', () => {
  it('takes the first non-empty definition, falling back to an entry description', () => {
    const meaning = (definition: string) => ({ definition }) as PublicWordV1T['meanings'][number];
    expect(
      leadDefinition([entry({ meanings: [meaning(' ')] }), entry({ meanings: [meaning('to move fast')] })]),
    ).toBe('to move fast');
    expect(leadDefinition([entry({ description: 'a plant' })])).toBe('a plant');
    expect(leadDefinition([entry({})])).toBeUndefined();
  });
});

describe('translationLanguages (issue #520)', () => {
  const entry = (short: string[], meanings: string[][]) =>
    ({
      short_translations: short.map((language, id) => ({ id, language, description: language })),
      meanings: meanings.map((languages, id) => ({
        id,
        translations: languages.map((language, n) => ({ id: n, language, title: language })),
      })),
    }) as unknown as import('server/types').PublicWordV1T;
  const entries = [entry(['ru', 'es'], [['fr', 'ru']]), entry(['de'], [['es', 'zh']])];

  it("lists every language once, the locale's first, the rest as they appear", () => {
    expect(translationLanguages(entries, 'es')).toEqual(['es', 'ru', 'fr', 'de', 'zh']);
    expect(translationLanguages(entries, 'en')).toEqual(['ru', 'es', 'fr', 'de', 'zh']);
  });

  it('is empty for a headword without translations', () => {
    expect(translationLanguages([entry([], [[]])], 'ru')).toEqual([]);
  });
});
