// The dictionary the website suite renders (issue #330). Mirrors
// apps/server/test/harness/public-api-fixture.ts — the seed of the SDK live
// tests — so every consumer of the public API asserts the same words. The
// literals mirror the server enums, the same way helpers/seed.ts does.

const meaning = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  definition: `definition of ${title}`,
  is_obsolete: false,
  sort_order: 1,
  examples: [],
  area_variant: 'common',
  translations: [],
  ...extra,
});

export const FIXTURE_WORDS: object[] = [
  {
    word: 'sprint',
    part_of_speech: 'verb',
    form_of_word: 'base_form',
    area_variant: 'common',
    meanings: [meaning('to run fast')],
  },
  {
    word: 'run',
    part_of_speech: 'verb',
    form_of_word: 'base_form',
    area_variant: 'common',
    word_level: 'A1',
    transcription: '/rʌn/',
    forms: [{ word: 'ran', form_of_word: 'past_simple', area_variant: 'common', transcription: 'ræn' }],
    meanings: [
      meaning('to move fast', {
        examples: ['He runs every morning.'],
        translations: [
          {
            language: 'ru',
            title: 'бежать',
            definition: 'бежать (definition)',
            variants_of_words: ['бежать'],
          },
        ],
        synonyms: ['sprint'],
      }),
    ],
    short_translations: [{ language: 'ru', description: 'бежать', variants_of_words: ['бежать'] }],
  },
  {
    word: 'abandon',
    part_of_speech: 'verb',
    form_of_word: 'base_form',
    area_variant: 'common',
    word_level: 'C1',
    meanings: [meaning('to leave')],
  },
];
