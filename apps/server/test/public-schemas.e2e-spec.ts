import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import Ajv, { ValidateFunction } from 'ajv';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { PublicOpenApiService } from '../src/modules/PublicApiModule/public-openapi.service';
import { PUBLIC_RESPONSES } from '../src/openapi/public-responses';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import {
  AvailableTranslationLanguagesE,
  CategoryE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
  WordLevelE,
} from '../types';

const E2E_USERNAME = 'e2e-admin';
const E2E_PASSWORD = 'e2e-password';

type JsonObjectT = Record<string, unknown>;

// The OpenAPI 3.0 schemas as a strict JSON Schema for ajv: `nullable` back
// into null unions, and no extra fields — the published schemas allow them
// (adding a field is not a breaking change), the test does not, so a leaked
// column such as createdAt fails here
const toStrictJsonSchema = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(toStrictJsonSchema);
  if (!node || typeof node !== 'object') return node;
  const schema = Object.fromEntries(
    Object.entries(node as JsonObjectT).map(([k, v]) => [k, toStrictJsonSchema(v)]),
  );
  if (schema.type === 'object' && schema.properties && !('additionalProperties' in schema)) {
    schema.additionalProperties = false;
  }
  if (schema.nullable === true) {
    delete schema.nullable;
    if (typeof schema.type === 'string') return { ...schema, type: [schema.type, 'null'] };
    const { allOf, anyOf, ...rest } = schema;
    const members = (allOf ?? anyOf ?? []) as unknown[];
    return { ...rest, anyOf: [...members, { type: 'null' }] };
  }
  return schema;
};

/**
 * The response schemas of the public contract (issue #305) are generated
 * from the TypeScript types the controllers return, and this suite proves
 * them against the running server: every public operation is called on a
 * seeded dictionary and its body validated with the schema the served
 * document names for it.
 */
describe('public API responses match their OpenAPI schemas (e2e, issue #305)', () => {
  let app: INestApplication<App>;
  let document: OpenAPIObject;
  let ajv: Ajv;
  const validators = new Map<string, ValidateFunction>();
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  let runId = 0;

  const ruTranslation = (title: string) => ({
    language: AvailableTranslationLanguagesE.ru,
    title,
    definition: `${title} (definition)`,
    variants_of_words: [title],
  });

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = E2E_USERNAME;
    process.env.ADMIN_PASSWORD = E2E_PASSWORD;
    const hashByEnv = await hashLoginString(E2E_USERNAME, E2E_PASSWORD);
    const secretHash = await hashLoginString(E2E_USERNAME, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();
    app.get(PublicOpenApiService).attach(app);

    const addWord = async (body: object): Promise<number> => {
      const res = await request(server()).post('/api/en/add/word').set(auth).send(body);
      if (res.status !== 201) throw new Error(`seed failed: ${JSON.stringify(res.body)}`);
      return (res.body as { id: number }).id;
    };
    await addWord({
      word: 'sprint',
      part_of_speech: EnPartOfSpeechE.verb,
      form_of_word: EnWordFormsE.base_form,
      meanings: [
        {
          title: 'to run fast',
          definition: 'd',
          is_obsolete: false,
          sort_order: 1,
          examples: [],
          area_variant: EnAreaVariantsE.common,
          translations: [],
        },
      ],
    });
    // a verb with everything the contract can carry: level, categories,
    // transcription, forms, meanings with translations and links, short translations
    runId = await addWord({
      word: 'run',
      part_of_speech: EnPartOfSpeechE.verb,
      form_of_word: EnWordFormsE.base_form,
      word_level: WordLevelE.A1,
      transcription: '/rʌn/',
      description: 'to move fast on foot',
      categories: [CategoryE.sport],
      area_variant: EnAreaVariantsE.common,
      verb___is_irregular: true,
      forms: [
        {
          word: 'ran',
          form_of_word: EnWordFormsE.past_simple,
          area_variant: EnAreaVariantsE.common,
          transcription: '/ræn/',
        },
        {
          word: 'running',
          form_of_word: EnWordFormsE.present_participle,
          area_variant: EnAreaVariantsE.common,
        },
      ],
      meanings: [
        {
          title: 'to move fast',
          definition: 'to move at a speed faster than a walk',
          is_obsolete: false,
          sort_order: 1,
          examples: ['He runs every morning.'],
          area_variant: EnAreaVariantsE.common,
          meaning_level: WordLevelE.A1,
          categories: [CategoryE.sport],
          translations: [ruTranslation('бежать')],
          synonyms: ['sprint'],
        },
      ],
      short_translations: [
        {
          language: AvailableTranslationLanguagesE.ru,
          description: 'бежать',
          variants_of_words: ['бежать', 'бегать'],
        },
      ],
    });
    await addWord({
      word: 'put up with',
      part_of_speech: EnPartOfSpeechE.phrase,
      form_of_word: EnWordFormsE.base_form,
      meanings: [
        {
          title: 'to tolerate',
          definition: 'd',
          is_obsolete: false,
          sort_order: 1,
          examples: [],
          area_variant: EnAreaVariantsE.common,
          translations: [],
        },
      ],
    });

    document = (await request(server()).get('/api/v1/openapi.json').expect(200)).body as OpenAPIObject;
    ajv = new Ajv({ strict: false, allErrors: true });
  });

  afterAll(async () => {
    await app.close();
  });

  const findOperation = (operationId: string): { path: string; method: string; responses: JsonObjectT } => {
    for (const [path, item] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(item as Record<string, JsonObjectT>)) {
        if (operation.operationId === operationId)
          return { path, method, responses: operation.responses as JsonObjectT };
      }
    }
    throw new Error(`Operation ${operationId} is not in the served document`);
  };

  const validate = (operationId: string, status: number, body: unknown) => {
    const { responses } = findOperation(operationId);
    const response = responses[String(status)] as JsonObjectT | undefined;
    expect(response).toBeDefined();
    const schema = (response!.content as Record<string, { schema: JsonObjectT }>)['application/json'].schema;
    const key = `${operationId}:${status}`;
    let validator = validators.get(key);
    if (!validator) {
      validator = ajv.compile({ ...schema, components: toStrictJsonSchema(document.components) });
      validators.set(key, validator);
    }
    if (!validator(body)) {
      throw new Error(
        `${key} does not match its schema:\n${ajv.errorsText(validator.errors, { separator: '\n' })}`,
      );
    }
  };

  it('describes every public operation with a success and an error schema', () => {
    for (const operationId of Object.keys(PUBLIC_RESPONSES)) {
      const { responses } = findOperation(operationId);
      // one 2xx per operation: 200 for the reads, 201 for the suggestion intake
      expect(Object.keys(responses).filter((status) => status.startsWith('2'))).toHaveLength(1);
    }
  });

  it('search and detailed search', async () => {
    const flat = await request(server()).post('/api/v1/search').send({ search: 'run' }).expect(200);
    validate('PublicSearchController_search', 200, flat.body);
    expect((flat.body as { data: unknown[] }).data.length).toBeGreaterThan(0);
    const detailed = await request(server())
      .post('/api/v1/search/detailed')
      .send({ search: 'run' })
      .expect(200);
    validate('PublicSearchController_searchDetailed', 200, detailed.body);
    const bad = await request(server()).post('/api/v1/search').send({ nope: 1 }).expect(400);
    validate('PublicSearchController_search', 400, bad.body);
  });

  it('the list with and without the joins, and its 400 on a foreign cursor', async () => {
    const plain = await request(server()).get('/api/v1/words').expect(200);
    validate('PublicWordsController_list', 200, plain.body);
    const joined = await request(server())
      .get('/api/v1/words')
      .query({ with_meanings: true, with_translations: true, form_of_word: ['base_form', 'past_simple'] })
      .expect(200);
    validate('PublicWordsController_list', 200, joined.body);
    const bad = await request(server()).get('/api/v1/words').query({ cursor: 'not-a-cursor' }).expect(400);
    validate('PublicWordsController_list', 400, bad.body);
  });

  it('the headword reads: entries, meanings, translations, forms, by id', async () => {
    const byId = await request(server()).get(`/api/v1/words/id/${runId}`).expect(200);
    validate('PublicWordsController_byId', 200, byId.body);
    const headword = await request(server()).get('/api/v1/words/run').expect(200);
    validate('PublicWordsController_byHeadword', 200, headword.body);
    const meanings = await request(server()).get('/api/v1/words/run/meanings').expect(200);
    validate('PublicWordsController_meanings', 200, meanings.body);
    const translations = await request(server()).get('/api/v1/words/run/translations').expect(200);
    validate('PublicWordsController_translations', 200, translations.body);
    const forms = await request(server()).get('/api/v1/words/run/forms').expect(200);
    validate('PublicWordsController_forms', 200, forms.body);
    expect((forms.body as { data: unknown[] }).data).toHaveLength(2);
    const missing = await request(server()).get('/api/v1/words/nonexistent').expect(404);
    validate('PublicWordsController_byHeadword', 404, missing.body);
  });

  it('random, meta and the document itself', async () => {
    const random = await request(server()).get('/api/v1/random').expect(200);
    validate('PublicDictionaryController_random', 200, random.body);
    const none = await request(server()).get('/api/v1/random').query({ word_level: 'C2' }).expect(404);
    validate('PublicDictionaryController_random', 404, none.body);
    const meta = await request(server()).get('/api/v1/meta').expect(200);
    validate('PublicDictionaryController_meta', 200, meta.body);
    validate('PublicOpenApiController_openapi', 200, document);
  });

  it('the suggestion intake (issue #327)', async () => {
    const created = await request(server())
      .post('/api/v1/suggestions')
      .send({ headword: 'run', message: 'The definition reads oddly — schema round-trip check.' })
      .expect(201);
    validate('PublicSuggestionsController_create', 201, created.body);

    const missing = await request(server())
      .post('/api/v1/suggestions')
      .send({ headword: 'zzz-no-such-word', message: 'A report about a word that does not exist.' })
      .expect(404);
    validate('PublicSuggestionsController_create', 404, missing.body);
  });
});
