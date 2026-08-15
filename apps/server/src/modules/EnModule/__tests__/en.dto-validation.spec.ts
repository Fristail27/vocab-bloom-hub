import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';

import { EnController } from '../en.controller';
import { AddWordReqDTO } from '../dto/AddWordReq.dto';
import { CheckWordQueryDTO } from '../dto/CheckWordQuery.dto';
import { EnMeaningTranslationController } from '../modules/EnMeaningTranslation/enMeaningTranslation.controller';
import { AddMeaningTranslationReqDTO } from '../modules/EnMeaningTranslation/dto/AddMeaningTranslationReq.dto';
import { EditMeaningTranslationReqDTO } from '../modules/EnMeaningTranslation/dto/EditMeaningTranslationReq.dto';
import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnPhrasalObjectPatternE,
  EnVerbTransitivityE,
  EnWordFormsE,
  LanguageRegisterE,
} from '../../../../types';

// Same options as the global pipe in main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validate = (metatype: ArgumentMetadata['metatype'], value: unknown, type: ArgumentMetadata['type']) =>
  pipe.transform(value, { type, metatype });

// Mirrors what EnWordForm sends: DefaultCommonData + the word/meanings/forms steps
const makeAddWordBody = () => ({
  id: 0,
  word: 'look up',
  part_of_speech: EnPartOfSpeechE.verb,
  generated: true,
  form_of_word: EnWordFormsE.base_form,
  generated_by_model: 'GPT-5.3-mini',
  categories: [],
  word_level: null,
  is_obsolete: false,
  version: 'custom_version',
  is_abbreviation: null,
  language_register: LanguageRegisterE.formal,
  area_variant: EnAreaVariantsE.common,
  transcription: '',
  description: '',
  noun___uncountable: false,
  noun___is_proper: false,
  noun___irregular_plural: false,
  verb___is_irregular: false,
  verb___transitivity: EnVerbTransitivityE.both,
  verb___is_phrasal: true,
  base_phrasal: 'look',
  verb___phrasal_object_pattern: EnPhrasalObjectPatternE.separable,
  forms: [
    {
      word: 'looked up',
      area_variant: EnAreaVariantsE.common,
      transcription: '',
      form_of_word: EnWordFormsE.past_simple,
    },
  ],
  meanings: [
    {
      title: 'to search for information',
      definition: 'to try to find a piece of information',
      is_obsolete: false,
      sort_order: 1,
      area_variant: EnAreaVariantsE.common,
      language_register: LanguageRegisterE.formal,
      examples: ['I looked it up in the dictionary'],
      meaning_level: null,
      translations: [
        {
          id: 0,
          language: AvailableTranslationLanguagesE.ru,
          title: 'искать',
          definition: 'искать информацию',
          variants_of_words: ['искать'],
        },
      ],
    },
  ],
  short_translations: [
    {
      id: 0,
      language: AvailableTranslationLanguagesE.ru,
      variants_of_words: ['искать'],
      description: '',
    },
  ],
});

describe('DTO wiring on previously unvalidated endpoints (issue #166)', () => {
  it('POST /api/en/add/:entryType body param is typed with AddWordReqDTO, not Object', () => {
    const paramTypes: unknown[] = Reflect.getMetadata('design:paramtypes', EnController.prototype, 'add');
    expect(paramTypes[1]).toBe(AddWordReqDTO);
  });

  it('GET /api/en/check-word/:word query param is typed with CheckWordQueryDTO, not Object', () => {
    const paramTypes: unknown[] = Reflect.getMetadata('design:paramtypes', EnController.prototype, 'checkWord');
    expect(paramTypes[1]).toBe(CheckWordQueryDTO);
  });

  it('meaning-translation endpoints are typed with their DTO classes, not Object', () => {
    const addParams: unknown[] = Reflect.getMetadata(
      'design:paramtypes',
      EnMeaningTranslationController.prototype,
      'addMeaningTranslation',
    );
    const editParams: unknown[] = Reflect.getMetadata(
      'design:paramtypes',
      EnMeaningTranslationController.prototype,
      'editMeaningTranslation',
    );
    expect(addParams[0]).toBe(AddMeaningTranslationReqDTO);
    expect(editParams[0]).toBe(EditMeaningTranslationReqDTO);
  });
});

describe('AddWordReqDTO validation (issue #166)', () => {
  it('accepts the payload shape the admin UI sends', async () => {
    await expect(validate(AddWordReqDTO, makeAddWordBody(), 'body')).resolves.toBeInstanceOf(AddWordReqDTO);
  });

  it('coerces null to undefined on NOT NULL columns with defaults, so the DB default applies', async () => {
    const body = { ...makeAddWordBody(), is_abbreviation: null, generated: null, categories: null };
    const dto = (await validate(AddWordReqDTO, body, 'body')) as AddWordReqDTO;
    expect(dto.is_abbreviation).toBeUndefined();
    expect(dto.generated).toBeUndefined();
    expect(dto.categories).toBeUndefined();
  });

  it('rejects unknown top-level fields', async () => {
    const body = { ...makeAddWordBody(), hacker_field: 'oops' };
    await expect(validate(AddWordReqDTO, body, 'body')).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown fields nested inside meanings', async () => {
    const body = makeAddWordBody();
    Object.assign(body.meanings[0]!, { hacker_field: 'oops' });
    await expect(validate(AddWordReqDTO, body, 'body')).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid part_of_speech', async () => {
    const body = { ...makeAddWordBody(), part_of_speech: 'not-a-pos' };
    await expect(validate(AddWordReqDTO, body, 'body')).rejects.toThrow(BadRequestException);
  });

  it('rejects a missing word', async () => {
    const { word: _word, ...body } = makeAddWordBody();
    await expect(validate(AddWordReqDTO, body, 'body')).rejects.toThrow(BadRequestException);
  });

  it('rejects a malformed meaning translation', async () => {
    const body = makeAddWordBody();
    Object.assign(body.meanings[0]!.translations[0]!, { title: 42 });
    await expect(validate(AddWordReqDTO, body, 'body')).rejects.toThrow(BadRequestException);
  });
});

describe('CheckWordQueryDTO validation (issue #166)', () => {
  it('accepts partOfSpeech with and without forPhrasal', async () => {
    await expect(
      validate(CheckWordQueryDTO, { partOfSpeech: EnPartOfSpeechE.verb, forPhrasal: 'true' }, 'query'),
    ).resolves.toBeInstanceOf(CheckWordQueryDTO);
    await expect(
      validate(CheckWordQueryDTO, { partOfSpeech: EnPartOfSpeechE.noun }, 'query'),
    ).resolves.toBeInstanceOf(CheckWordQueryDTO);
  });

  it('rejects an invalid partOfSpeech and unknown params', async () => {
    await expect(validate(CheckWordQueryDTO, { partOfSpeech: 'nope' }, 'query')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      validate(CheckWordQueryDTO, { partOfSpeech: EnPartOfSpeechE.verb, extra: '1' }, 'query'),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('AddMeaningTranslationReqDTO validation (issue #166)', () => {
  const makeBody = () => ({
    meaning_id: 1,
    language: AvailableTranslationLanguagesE.ru,
    title: 'искать',
    definition: 'искать информацию',
    variants_of_words: ['искать'],
  });

  it('accepts the payload the admin UI sends (no id)', async () => {
    await expect(validate(AddMeaningTranslationReqDTO, makeBody(), 'body')).resolves.toBeInstanceOf(
      AddMeaningTranslationReqDTO,
    );
  });

  it('rejects unknown fields', async () => {
    await expect(
      validate(AddMeaningTranslationReqDTO, { ...makeBody(), hacker_field: 'oops' }, 'body'),
    ).rejects.toThrow(BadRequestException);
  });
});
