import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';

import { AddWordFormReqDTO } from '../dto/AddWordFormReq.dto';
import { EditWordFormReqDTO } from '../dto/EditWordFormReq.dto';
import { EditCommonInfoOfWordReqDTO } from '../dto/EditCommonInfoOfWordReq.dto';
import { EditPhrasalBaseReqDTO } from '../dto/EditPhrasalBase.dto';
import { AddMeaningReqDTO } from '../modules/EnMeaning/dto/AddMeaningReq.dto';
import { EditMeaningReqDTO } from '../modules/EnMeaning/dto/EditMeaningReq.dto';
import { EditMeaningTranslationReqDTO } from '../modules/EnMeaningTranslation/dto/EditMeaningTranslationReq.dto';
import { AddShortTranslationReqDTO } from '../modules/EnShortTranslation/dto/AddShortTranslationReq.dto';
import { EditShortTranslationReqDTO } from '../modules/EnShortTranslation/dto/EditShortTranslationReq.dto';
import { ImportDictionaryReq } from '../modules/EnImportDictionary/dto/ImportDictionaryReq.dto';
import {
  AvailableTranslationLanguagesE,
  CategoryE,
  EnAreaVariantsE,
  EnWordFormsE,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../types';

// Same options as the global pipe in main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validate = (
  metatype: ArgumentMetadata['metatype'],
  value: unknown,
  type: ArgumentMetadata['type'] = 'body',
) => pipe.transform(value, { type, metatype });

describe('EditCommonInfoOfWordReqDTO validation (issue #87)', () => {
  it('accepts a partial payload — every field is optional', async () => {
    await expect(validate(EditCommonInfoOfWordReqDTO, {})).resolves.toBeInstanceOf(EditCommonInfoOfWordReqDTO);
    await expect(
      validate(EditCommonInfoOfWordReqDTO, {
        description: 'to move fast',
        is_obsolete: false,
        word_level: WordLevelE.A1,
        area_variant: EnAreaVariantsE.british,
        language_register: LanguageRegisterE.informal,
        categories: [CategoryE.sport],
        pattern: ['would rather', 'verb'],
        verb___is_irregular: true,
      }),
    ).resolves.toBeInstanceOf(EditCommonInfoOfWordReqDTO);
  });

  it('rejects unknown fields', async () => {
    await expect(validate(EditCommonInfoOfWordReqDTO, { hacker_field: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects wrong types and enum values', async () => {
    await expect(validate(EditCommonInfoOfWordReqDTO, { is_obsolete: 'yes' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate(EditCommonInfoOfWordReqDTO, { word_level: 'Z9' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate(EditCommonInfoOfWordReqDTO, { categories: ['not-a-category'] })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate(EditCommonInfoOfWordReqDTO, { pattern: [42] })).rejects.toThrow(BadRequestException);
  });
});

describe('AddWordFormReqDTO validation (issue #87)', () => {
  const makeBody = () => ({
    word: 'ran',
    form_of_word: EnWordFormsE.past_simple,
    transcription: 'ræn',
    area_variant: EnAreaVariantsE.common,
    base_word_id: 1,
  });

  it('accepts the payload the admin UI sends', async () => {
    await expect(validate(AddWordFormReqDTO, makeBody())).resolves.toBeInstanceOf(AddWordFormReqDTO);
  });

  it('rejects a payload with a missing required field', async () => {
    const { base_word_id: _id, ...body } = makeBody();
    await expect(validate(AddWordFormReqDTO, body)).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid form_of_word and unknown fields', async () => {
    await expect(validate(AddWordFormReqDTO, { ...makeBody(), form_of_word: 'nope' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate(AddWordFormReqDTO, { ...makeBody(), hacker_field: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('EditWordFormReqDTO validation (issue #87)', () => {
  it('accepts a partial payload with a numeric id', async () => {
    await expect(validate(EditWordFormReqDTO, { id: 1 })).resolves.toBeInstanceOf(EditWordFormReqDTO);
    await expect(
      validate(EditWordFormReqDTO, {
        id: 1,
        word: 'ran',
        transcription: 'ræn',
        area_variant: EnAreaVariantsE.british,
      }),
    ).resolves.toBeInstanceOf(EditWordFormReqDTO);
  });

  it('rejects a missing or non-numeric id and unknown fields', async () => {
    await expect(validate(EditWordFormReqDTO, { word: 'ran' })).rejects.toThrow(BadRequestException);
    await expect(validate(EditWordFormReqDTO, { id: 'one' })).rejects.toThrow(BadRequestException);
    await expect(validate(EditWordFormReqDTO, { id: 1, hacker_field: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('EditPhrasalBaseReqDTO validation (issue #87)', () => {
  it('accepts two numeric ids and rejects everything else', async () => {
    await expect(validate(EditPhrasalBaseReqDTO, { id: 1, phrasal_base_id: 2 })).resolves.toBeInstanceOf(
      EditPhrasalBaseReqDTO,
    );
    await expect(validate(EditPhrasalBaseReqDTO, { id: 1 })).rejects.toThrow(BadRequestException);
    await expect(validate(EditPhrasalBaseReqDTO, { id: 1, phrasal_base_id: 'two' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      validate(EditPhrasalBaseReqDTO, { id: 1, phrasal_base_id: 2, hacker_field: 'oops' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('AddMeaningReqDTO validation (issue #87)', () => {
  const makeBody = () => ({
    word_id: 1,
    title: 'to move fast',
    definition: 'to move fast on foot',
    examples: ['I run every morning'],
    sort_order: 1,
    is_obsolete: false,
    meaning_level: WordLevelE.A1,
    area_variant: EnAreaVariantsE.common,
    language_register: LanguageRegisterE.informal,
    categories: [CategoryE.sport],
    translations: [
      {
        id: 0,
        language: AvailableTranslationLanguagesE.ru,
        title: 'бежать',
        definition: 'быстро перемещаться',
        variants_of_words: ['бежать'],
      },
    ],
  });

  it('accepts the payload the admin UI sends', async () => {
    await expect(validate(AddMeaningReqDTO, makeBody())).resolves.toBeInstanceOf(AddMeaningReqDTO);
  });

  it('rejects a payload with a missing required field', async () => {
    const { title: _title, ...body } = makeBody();
    await expect(validate(AddMeaningReqDTO, body)).rejects.toThrow(BadRequestException);
  });

  it('rejects a malformed nested translation and unknown fields', async () => {
    const body = makeBody();
    Object.assign(body.translations[0], { title: 42 });
    await expect(validate(AddMeaningReqDTO, body)).rejects.toThrow(BadRequestException);

    await expect(validate(AddMeaningReqDTO, { ...makeBody(), hacker_field: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('EditMeaningReqDTO validation (issue #87)', () => {
  it('accepts a partial payload with a numeric id', async () => {
    await expect(validate(EditMeaningReqDTO, { id: 1, title: 'to jog' })).resolves.toBeInstanceOf(
      EditMeaningReqDTO,
    );
  });

  it('rejects a missing id, bad enum values and unknown fields', async () => {
    await expect(validate(EditMeaningReqDTO, { title: 'to jog' })).rejects.toThrow(BadRequestException);
    await expect(validate(EditMeaningReqDTO, { id: 1, meaning_level: 'Z9' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate(EditMeaningReqDTO, { id: 1, hacker_field: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('EditMeaningTranslationReqDTO validation (issue #87)', () => {
  it('accepts a partial payload with a numeric id', async () => {
    await expect(
      validate(EditMeaningTranslationReqDTO, { id: 1, title: 'мчаться', variant_of_words: ['мчаться'] }),
    ).resolves.toBeInstanceOf(EditMeaningTranslationReqDTO);
  });

  it('rejects a missing id, a bad language and unknown fields', async () => {
    await expect(validate(EditMeaningTranslationReqDTO, { title: 'мчаться' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate(EditMeaningTranslationReqDTO, { id: 1, language: 'xx' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validate(EditMeaningTranslationReqDTO, { id: 1, hacker_field: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('AddShortTranslationReqDTO validation (issue #87)', () => {
  const makeBody = () => ({
    word_id: 1,
    language: AvailableTranslationLanguagesE.ru,
    description: 'бежать',
    variant_of_words: ['бежать'],
  });

  it('accepts the payload the admin UI sends', async () => {
    await expect(validate(AddShortTranslationReqDTO, makeBody())).resolves.toBeInstanceOf(
      AddShortTranslationReqDTO,
    );
  });

  it('rejects a payload with a missing required field and unknown fields', async () => {
    const { description: _d, ...body } = makeBody();
    await expect(validate(AddShortTranslationReqDTO, body)).rejects.toThrow(BadRequestException);
    await expect(validate(AddShortTranslationReqDTO, { ...makeBody(), hacker_field: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('EditShortTranslationReqDTO validation (issue #87)', () => {
  it('accepts a partial payload with a numeric id', async () => {
    await expect(
      validate(EditShortTranslationReqDTO, { id: 1, description: 'мчаться' }),
    ).resolves.toBeInstanceOf(EditShortTranslationReqDTO);
  });

  it('rejects a missing id, wrong types and unknown fields', async () => {
    await expect(validate(EditShortTranslationReqDTO, { description: 'мчаться' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      validate(EditShortTranslationReqDTO, { id: 1, variant_of_words: 'not-an-array' }),
    ).rejects.toThrow(BadRequestException);
    await expect(validate(EditShortTranslationReqDTO, { id: 1, hacker_field: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('ImportDictionaryReq validation (issue #87)', () => {
  it('accepts an empty body', async () => {
    await expect(validate(ImportDictionaryReq, {})).resolves.toBeInstanceOf(ImportDictionaryReq);
  });

  it('rejects unknown fields, including the removed user_version', async () => {
    await expect(validate(ImportDictionaryReq, { user_version: '1.2.3' })).rejects.toThrow(BadRequestException);
    await expect(validate(ImportDictionaryReq, { hacker_field: 'oops' })).rejects.toThrow(BadRequestException);
  });
});
