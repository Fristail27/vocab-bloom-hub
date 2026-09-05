import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';

import { LIST_WORDS_MAX_LIMIT, ListWordsQueryDTO } from '../dto/ListWordsQuery.dto';
import { ListMeaningsQueryDTO } from '../dto/ListMeaningsQuery.dto';
import { ListMeaningTranslationsQueryDTO } from '../dto/ListMeaningTranslationsQuery.dto';
import { ListShortTranslationsQueryDTO } from '../dto/ListShortTranslationsQuery.dto';
import { LIST_MAX_LIMIT } from '../dto/PaginationQuery.dto';
import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../../../types';

// Same options as the global pipe in main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validateAs = (metatype: new () => object) => (value: unknown) =>
  pipe.transform(value, { type: 'query', metatype } as ArgumentMetadata);
const validate = validateAs(ListWordsQueryDTO);

describe('ListWordsQueryDTO (issue #249)', () => {
  it('applies the pagination defaults to an empty query', async () => {
    await expect(validate({})).resolves.toMatchObject({ page: 1, limit: 50 });
  });

  it('converts numeric strings and keeps them inside the limits', async () => {
    await expect(validate({ page: '3', limit: '200' })).resolves.toMatchObject({ page: 3, limit: 200 });
    await expect(validate({ page: '0' })).rejects.toThrow(BadRequestException);
    await expect(validate({ limit: String(LIST_WORDS_MAX_LIMIT + 1) })).rejects.toThrow(BadRequestException);
    await expect(validate({ limit: '1.5' })).rejects.toThrow(BadRequestException);
  });

  it('accepts a single value or a repeated key for enum arrays', async () => {
    await expect(validate({ part_of_speech: 'noun' })).resolves.toMatchObject({
      part_of_speech: [EnPartOfSpeechE.noun],
    });
    await expect(validate({ part_of_speech: ['noun', 'verb'], word_level: 'A1' })).resolves.toMatchObject({
      part_of_speech: [EnPartOfSpeechE.noun, EnPartOfSpeechE.verb],
      word_level: [WordLevelE.A1],
    });
    await expect(validate({ part_of_speech: 'adjectiv' })).rejects.toThrow(BadRequestException);
    await expect(validate({ area_variant: ['common', 'martian'] })).rejects.toThrow(BadRequestException);
  });

  it('parses boolean flags from their string form and rejects anything else', async () => {
    await expect(
      validate({
        generated: 'true',
        is_obsolete: 'false',
        has_meanings: 'true',
        has_short_translations: 'false',
      }),
    ).resolves.toMatchObject({
      generated: true,
      is_obsolete: false,
      has_meanings: true,
      has_short_translations: false,
    });
    await expect(validate({ generated: 'yes' })).rejects.toThrow(BadRequestException);
    await expect(validate({ has_meanings: '1' })).rejects.toThrow(BadRequestException);
  });

  it('keeps the string filters and rejects unknown keys', async () => {
    await expect(
      validate({ search: 'ab', generated_by_model: 'model-a', version: '1.2.3' }),
    ).resolves.toMatchObject({ search: 'ab', generated_by_model: 'model-a', version: '1.2.3' });
    await expect(validate({ sort: 'word' })).rejects.toThrow(BadRequestException);
    await expect(validate({ search: 'a'.repeat(129) })).rejects.toThrow(BadRequestException);
  });
});

describe('ListMeaningsQueryDTO (issue #249)', () => {
  const validateMeanings = validateAs(ListMeaningsQueryDTO);

  it('shares the pagination defaults and limits', async () => {
    await expect(validateMeanings({})).resolves.toMatchObject({ page: 1, limit: 50 });
    await expect(validateMeanings({ page: '2', limit: String(LIST_MAX_LIMIT) })).resolves.toMatchObject({
      page: 2,
      limit: LIST_MAX_LIMIT,
    });
    await expect(validateMeanings({ limit: String(LIST_MAX_LIMIT + 1) })).rejects.toThrow(BadRequestException);
  });

  it('parses the meaning filters', async () => {
    await expect(
      validateMeanings({
        search: 'ru',
        part_of_speech: 'verb',
        area_variant: ['british', 'common'],
        meaning_level: 'B2',
        language_register: 'informal',
        is_obsolete: 'true',
        has_translations: 'false',
      }),
    ).resolves.toMatchObject({
      search: 'ru',
      part_of_speech: [EnPartOfSpeechE.verb],
      area_variant: [EnAreaVariantsE.british, EnAreaVariantsE.common],
      meaning_level: [WordLevelE.B2],
      language_register: [LanguageRegisterE.informal],
      is_obsolete: true,
      has_translations: false,
    });
  });

  it('rejects word-only filters, unknown keys and invalid values', async () => {
    await expect(validateMeanings({ generated: 'true' })).rejects.toThrow(BadRequestException);
    await expect(validateMeanings({ word_level: 'A1' })).rejects.toThrow(BadRequestException);
    await expect(validateMeanings({ meaning_level: 'Z9' })).rejects.toThrow(BadRequestException);
    await expect(validateMeanings({ has_translations: 'maybe' })).rejects.toThrow(BadRequestException);
  });
});

describe('ListMeaningTranslationsQueryDTO (issue #249)', () => {
  const validateTranslations = validateAs(ListMeaningTranslationsQueryDTO);

  it('parses the translation filters with the shared pagination', async () => {
    await expect(validateTranslations({})).resolves.toMatchObject({ page: 1, limit: 50 });
    await expect(
      validateTranslations({ search: 'ru', part_of_speech: ['noun', 'verb'], language: 'ru', page: '3' }),
    ).resolves.toMatchObject({
      search: 'ru',
      part_of_speech: [EnPartOfSpeechE.noun, EnPartOfSpeechE.verb],
      language: [AvailableTranslationLanguagesE.ru],
      page: 3,
    });
  });

  it('rejects unknown keys and languages', async () => {
    await expect(validateTranslations({ language: 'xx' })).rejects.toThrow(BadRequestException);
    await expect(validateTranslations({ has_translations: 'true' })).rejects.toThrow(BadRequestException);
    await expect(validateTranslations({ is_obsolete: 'true' })).rejects.toThrow(BadRequestException);
  });
});

describe('ListShortTranslationsQueryDTO (issue #411)', () => {
  const validateShortTranslations = validateAs(ListShortTranslationsQueryDTO);

  it('parses the short translation filters with the shared pagination', async () => {
    await expect(validateShortTranslations({})).resolves.toMatchObject({ page: 1, limit: 50 });
    await expect(
      validateShortTranslations({ search: 'ru', part_of_speech: ['noun', 'verb'], language: 'ru', page: '2' }),
    ).resolves.toMatchObject({
      search: 'ru',
      part_of_speech: [EnPartOfSpeechE.noun, EnPartOfSpeechE.verb],
      language: [AvailableTranslationLanguagesE.ru],
      page: 2,
    });
  });

  it('rejects unknown keys and languages', async () => {
    await expect(validateShortTranslations({ language: 'xx' })).rejects.toThrow(BadRequestException);
    await expect(validateShortTranslations({ has_meanings: 'true' })).rejects.toThrow(BadRequestException);
    await expect(validateShortTranslations({ search: 'a'.repeat(129) })).rejects.toThrow(BadRequestException);
  });
});
