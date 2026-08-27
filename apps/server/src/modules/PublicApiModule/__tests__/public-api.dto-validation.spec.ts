import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListWordsV1QueryDTO, PUBLIC_LIST_DEFAULT_LIMIT } from '../dto/ListWordsV1Query.dto';
import { WordFiltersV1QueryDTO } from '../dto/WordFiltersV1Query.dto';
import { EnWordFormsE } from '../../../../types';

// Query strings arrive as strings and single values; the DTOs must accept
// what a URL can carry and reject what the filters cannot bind
describe('public API v1 query DTOs (issue #272)', () => {
  const build = <T extends object>(cls: new () => T, query: Record<string, unknown>) =>
    plainToInstance(cls, query, { enableImplicitConversion: false });

  it('applies the list defaults: base forms only, 20 items, no joins', async () => {
    const dto = build(ListWordsV1QueryDTO, {});
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      form_of_word: [EnWordFormsE.base_form],
      limit: PUBLIC_LIST_DEFAULT_LIMIT,
      with_meanings: false,
      with_translations: false,
    });
  });

  it('turns single query values into arrays and boolean strings into booleans', async () => {
    const dto = build(ListWordsV1QueryDTO, {
      part_of_speech: 'noun',
      word_level: ['B1', 'B2'],
      category: 'IT',
      limit: '5',
      with_meanings: 'true',
      cursor: 'abc',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      part_of_speech: ['noun'],
      word_level: ['B1', 'B2'],
      category: ['IT'],
      limit: 5,
      with_meanings: true,
      cursor: 'abc',
    });
  });

  it('rejects values outside the enums and the limit range', async () => {
    const wrongEnum = await validate(build(WordFiltersV1QueryDTO, { word_level: 'Z9' }));
    expect(wrongEnum.map((e) => e.property)).toEqual(['word_level']);
    const wrongLimit = await validate(build(ListWordsV1QueryDTO, { limit: '101' }));
    expect(wrongLimit.map((e) => e.property)).toEqual(['limit']);
    const wrongBoolean = await validate(build(ListWordsV1QueryDTO, { with_meanings: 'yes' }));
    expect(wrongBoolean.map((e) => e.property)).toEqual(['with_meanings']);
  });
});
