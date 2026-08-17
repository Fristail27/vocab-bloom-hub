import { APIRequestContext } from '@playwright/test';

import { API_URL } from '../config';

// The literals mirror the server enums (EnPartOfSpeechE etc.); the payload
// shape follows apps/server/test/en-word-crud.e2e-spec.ts
export const wordPayload = (word: string, overrides: Record<string, unknown> = {}) => ({
  word,
  part_of_speech: 'verb',
  form_of_word: 'base_form',
  // Without an area_variant the edit page crashes on <Icon name={undefined}>,
  // so seeded words always carry one, like words created through the UI
  area_variant: 'common',
  description: `to ${word} fast`,
  forms: [
    {
      word: `${word}ed`,
      form_of_word: 'past_simple',
      area_variant: 'common',
      transcription: word,
    },
  ],
  meanings: [
    {
      title: `${word} meaning`,
      definition: `definition of ${word}`,
      is_obsolete: false,
      sort_order: 1,
      examples: [`I ${word} every day`],
      area_variant: 'common',
      translations: [
        {
          language: 'ru',
          title: `перевод ${word}`,
          definition: `определение ${word}`,
          variants_of_words: [`перевод-${word}`],
        },
      ],
    },
  ],
  short_translations: [
    {
      language: 'ru',
      description: `перевод ${word}`,
      variants_of_words: [`перевод-${word}`],
    },
  ],
  ...overrides,
});

// Seeds a word through the real admin API (the request context carries the
// bearer cookie from the saved storageState) and returns the created word id
export const seedWord = async (
  request: APIRequestContext,
  word: string,
  overrides: Record<string, unknown> = {},
): Promise<number> => {
  const addRes = await request.post(`${API_URL}/en/add/word`, { data: wordPayload(word, overrides) });
  if (!addRes.ok()) {
    throw new Error(`Seeding "${word}" failed with ${addRes.status()}: ${await addRes.text()}`);
  }

  // The add endpoint echoes the payload back without an id — resolve it
  const checkRes = await request.get(`${API_URL}/en/check-word/${word}?partOfSpeech=verb`);
  const check = (await checkRes.json()) as { hasWord?: boolean; id?: number };
  if (!checkRes.ok() || !check.hasWord || typeof check.id !== 'number') {
    throw new Error(`Could not resolve the id of the seeded word "${word}": ${JSON.stringify(check)}`);
  }
  return check.id;
};
