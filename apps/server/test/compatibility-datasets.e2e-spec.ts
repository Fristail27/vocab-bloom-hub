import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { checkIsPostgres } from '../configuration';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { AppModule } from '../src/modules/AppModule/app.module';
import { DatasetsService } from '../src/modules/DatasetsModule/datasets.service';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { apiCorsOptions } from '../src/core/utils/api-cors';
import { weakEtagOf } from '../src/core/utils/http-cache';
import type { DictionaryApiV2DatasetsResT, FreeDictionaryDatasetsResT } from '../types';

const dictionary = '/api/compat/dictionaryapi/v2/entries/en';
const free = '/api/compat/freedictionaryapi/v1/entries/en';
const INACTIVE = 'compat_fixture';
const keys = ['PUBLIC_API_ENABLED', 'PUBLIC_API_RATE_LIMIT', 'INTERNAL_API_TOKEN'] as const;

describe('compatibility responses from every dataset', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();
  const auth = { Authorization: '' };
  const saved = new Map<string, string | undefined>();

  const add = async (word: string, dataset = 'default', definition = 'An original fixture definition.') => {
    await request(server())
      .post(`/api/en/add/word?dataset=${dataset}`)
      .set(auth)
      .send({
        word,
        part_of_speech: 'verb',
        form_of_word: 'base_form',
        forms: [{ word: `${word}ed`, form_of_word: 'past_simple', area_variant: 'common' }],
        meanings: [
          {
            title: 'Fixture',
            definition,
            is_obsolete: false,
            sort_order: 1,
            area_variant: 'common',
            examples: ['An original example.'],
            translations: [
              { language: 'ru', title: 'Значение', definition: 'Описание', variants_of_words: ['слово'] },
            ],
          },
        ],
      })
      .expect(201);
  };

  beforeAll(async () => {
    for (const key of keys) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.PUBLIC_API_RATE_LIMIT = '100000/60';
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const hash = await hashLoginString('e2e-admin', 'e2e-password');
    const secret = await hashLoginString('e2e-admin', hash);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secret + hash)}`;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.enableCors(apiCorsOptions(['https://admin.example']));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.listen(0, '127.0.0.1');
    for (const word of ['glimmer', 'Polish', 'polish', 'literal%20word']) await add(word);
    if (checkIsPostgres()) {
      await request(server())
        .post('/api/en/datasets')
        .set(auth)
        .send({
          name: INACTIVE,
          title: 'Compatibility fixture',
          license: { spdx: 'CC0-1.0' },
          attribution: 'Fixture author',
        })
        .expect(201);
      await add('glimmer', INACTIVE, 'A definition from another dataset.');
      await add('inactiveonly', INACTIVE);
      await request(server())
        .patch(`/api/en/datasets/${INACTIVE}/visibility`)
        .set(auth)
        .send({ is_public: true })
        .expect(200);
    }
  });

  afterEach(() => {
    delete process.env.PUBLIC_API_ENABLED;
    delete process.env.INTERNAL_API_TOKEN;
    process.env.PUBLIC_API_RATE_LIMIT = '100000/60';
  });

  afterAll(async () => {
    await app?.close();
    for (const key of keys) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('embeds the ordinary adapter response, including forms, provenance and each spelling rule', async () => {
    for (const prefix of [dictionary, dictionary.replace('/v2/', '/v1/'), free]) {
      for (const word of ['glimmer', 'glimmered', 'Polish', 'literal%20word']) {
        const url = `${prefix}/${encodeURIComponent(word)}`;
        const ordinary = await request(server()).get(url).expect(200);
        const all = await request(server()).get(`${url}/datasets`).expect(200);
        expect(all.body.data.find((g: { dataset: string }) => g.dataset === 'default')).toMatchObject({
          dataset: 'default',
          active: true,
          status: 200,
          response: ordinary.body,
        });
        expect(all.body.meta).toMatchObject({ word, language: 'en', datasets: checkIsPostgres() ? 2 : 1 });
      }
    }
    const folded = await request(server()).get(`${dictionary}/GLIMMER/datasets`).expect(200);
    expect(folded.body.meta.found).toBe(checkIsPostgres() ? 2 : 1);
    const exact = await request(server()).get(`${free}/GLIMMER/datasets`).expect(200);
    expect(exact.body.meta.found).toBe(0);
  });

  it('retains groups on a miss in each adapter format and never borrows active terms', async () => {
    const missing = await request(server()).get(`${dictionary}/not-a-fixture`).expect(404);
    const all = await request(server()).get(`${dictionary}/not-a-fixture/datasets`).expect(200);
    expect(all.body.meta.found).toBe(0);
    for (const group of all.body.data) expect(group).toMatchObject({ status: 404, response: missing.body });
    const empty = await request(server()).get(`${free}/not-a-fixture/datasets`).expect(200);
    expect(empty.body.meta.found).toBe(0);
    for (const group of (empty.body as FreeDictionaryDatasetsResT).data) {
      expect(group.response.entries).toEqual([]);
      expect(group.response.vocabBloom.dataset).toBe(group.dataset);
      expect(group.response.vocabBloom.license).toBe(group.license);
      expect(group.response.source.url).toContain('/not-a-fixture/datasets');
    }
    await request(server())
      .get(`${dictionary.replace('/entries/en', '/entries/fr')}/glimmer/datasets`)
      .expect(404);
    const foreign = await request(server())
      .get(`${free.replace('/entries/en', '/entries/fr')}/glimmer/datasets`)
      .expect(200);
    expect(foreign.body.meta.found).toBe(0);
  });

  it('validates queries and formats translations and the whole pretty response', async () => {
    await request(server()).get(`${dictionary}/glimmer/datasets?dataset=default`).expect(400);
    await request(server()).get(`${free}/glimmer/datasets?dataset=default`).expect(400);
    await request(server()).get(`${free}/glimmer/datasets?translations=1`).expect(400);
    await request(server())
      .get(`${dictionary}/${'x'.repeat(129)}/datasets`)
      .expect(400);
    const compact = await request(server()).get(`${free}/glimmer/datasets?translations=true`).expect(200);
    const pretty = await request(server())
      .get(`${free}/glimmer/datasets?translations=true&pretty=true`)
      .expect(200);
    expect(pretty.text).toBe(JSON.stringify(compact.body, null, 2));
    expect(pretty.headers.etag).toBe(weakEtagOf(pretty.text));
    expect(pretty.headers.etag).not.toBe(compact.headers.etag);
    expect(pretty.body.data[0].response.entries[0].senses[0].translations[0].word).toBe('слово');
  });

  it('supports anonymous CORS, conditional GET and HEAD', async () => {
    for (const prefix of [dictionary, free]) {
      const url = `${prefix}/glimmer/datasets`;
      const res = await request(server()).get(url).set('Origin', 'https://reader.example').expect(200);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['x-api-version']).toBeUndefined();
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['last-modified']).toBeDefined();
      await request(server()).get(url).set('If-None-Match', res.headers.etag).expect(304);
      const head = await request(server()).head(url).expect(200);
      expect(head.headers.etag).toBe(res.headers.etag);
      expect(head.text).toBeUndefined();
    }
  });

  (checkIsPostgres() ? it : it.skip)(
    'reads inactive schemas, their own terms and their newest edits without activation',
    async () => {
      const registry = app.get(DatasetsService);
      expect(registry.getActive().name).toBe('default');
      const before = await request(server()).get(`${dictionary}/glimmer/datasets`).expect(200);
      const groups = (before.body as DictionaryApiV2DatasetsResT).data;
      const own = groups.find((g) => g.dataset === INACTIVE)!;
      expect(own).toMatchObject({ active: false, source: INACTIVE, license: 'CC0-1.0', status: 200 });
      if (own.status !== 200) throw new Error('inactive dataset should hold the word');
      expect(own.response[0].meanings[0].definitions[0].definition).toBe('A definition from another dataset.');
      expect(own.response[0].vocabBloom).toMatchObject({ dataset: INACTIVE, source: INACTIVE, modified: true });
      const otherOnly = await request(server()).get(`${dictionary}/inactiveonly/datasets`).expect(200);
      expect(otherOnly.body.meta.found).toBe(1);
      await request(server()).get(`${dictionary}/inactiveonly`).expect(404);

      const dataset = (await registry.installed()).find((d) => d.name === INACTIVE)!;
      const db = await registry.reader(dataset);
      const entry = await db
        .getRepository(EnWord)
        .createQueryBuilder('word')
        .where('word.word = :headword', { headword: 'glimmer' })
        .getOneOrFail();
      await db
        .getRepository(EnWord)
        .update(entry.id, { transcription: '/changed/', updateAt: new Date('2050-01-02T03:04:05Z') });
      registry.contentChanged(dataset);
      const changed = await request(server())
        .get(`${dictionary}/glimmer/datasets`)
        .set('If-None-Match', before.headers.etag)
        .expect(200);
      expect(changed.headers.etag).not.toBe(before.headers.etag);
      expect(changed.headers['last-modified']).toBe('Sun, 02 Jan 2050 03:04:05 GMT');
      expect(registry.getActive().name).toBe('default');

      // The wrapper's nested object uses the same free-dictionary reader on the inactive schema.
      const comparison = await request(server()).get(`${free}/glimmer/datasets?translations=true`).expect(200);
      const inactive = (comparison.body as FreeDictionaryDatasetsResT).data.find(
        (g) => g.dataset === INACTIVE,
      )!;
      expect(inactive.response.entries[0].senses[0].definition).toBe('A definition from another dataset.');
      expect(inactive.response.vocabBloom.active).toBe(false);
    },
  );

  (checkIsPostgres() ? it : it.skip)(
    'closes every public surface without hiding admin data, then reopens it',
    async () => {
      const paths = [
        '/api/v1/words/glimmer/datasets',
        `${dictionary}/glimmer/datasets`,
        `${dictionary.replace('/v2/', '/v1/')}/glimmer/datasets`,
        `${free}/glimmer/datasets`,
      ];
      const registry = app.get(DatasetsService);
      // Reset the artificial future content date from the preceding cache test.
      const dataset = await registry.find(INACTIVE);
      const db = await registry.reader(dataset);
      await db.getRepository(EnWord).createQueryBuilder().update().set({ updateAt: new Date() }).execute();
      registry.contentChanged(dataset);
      const before = await Promise.all(paths.map((path) => request(server()).get(path).expect(200)));
      process.env.INTERNAL_API_TOKEN = 'visibility-test-internal-token';
      try {
        const closed = await request(server())
          .patch(`/api/en/datasets/${INACTIVE}/visibility`)
          .set(auth)
          .send({ is_public: false })
          .expect(200);
        expect(closed.body.is_public).toBe(false);
        for (const [i, path] of paths.entries()) {
          const response = await request(server())
            .get(path)
            .set('If-None-Match', before[i].headers.etag)
            .set('X-Internal-Token', process.env.INTERNAL_API_TOKEN)
            .expect(200);
          expect(response.body.data.map((group: { dataset: string }) => group.dataset)).not.toContain(INACTIVE);
          expect(response.body.meta.datasets).toBe(before[i].body.meta.datasets - 1);
          expect(response.headers['cache-control']).toBe('public, no-cache, must-revalidate');
          await request(server())
            .get(path)
            .set('If-Modified-Since', before[i].headers['last-modified'])
            .expect(200);
        }
        await request(server())
          .get(`/api/v1/words/glimmer/datasets/${INACTIVE}/history`)
          .set('X-Internal-Token', process.env.INTERNAL_API_TOKEN)
          .expect(404);
        await request(server()).get('/api/v1/words/inactiveonly/datasets').expect(404);
        await request(server())
          .get('/api/en/search')
          .query({ dataset: INACTIVE, search: 'inactiveonly' })
          .set(auth)
          .expect(200);
        expect((await registry.find(INACTIVE)).is_public).toBe(false);
        const activate = await request(server())
          .post(`/api/en/datasets/${INACTIVE}/activate`)
          .set(auth)
          .expect(409);
        expect(activate.body.message).toBe('dataset_is_closed');
        const active = await request(server())
          .patch('/api/en/datasets/default/visibility')
          .set(auth)
          .send({ is_public: false })
          .expect(409);
        expect(active.body.message).toBe('dataset_active_must_be_public');
      } finally {
        await request(server())
          .patch(`/api/en/datasets/${INACTIVE}/visibility`)
          .set(auth)
          .send({ is_public: true })
          .expect(200);
      }
      await request(server()).get('/api/v1/words/inactiveonly/datasets').expect(200);
      await request(server()).get(`/api/v1/words/glimmer/datasets/${INACTIVE}/history`).expect(200);
    },
  );

  it('shares public visibility and rate limits with the ordinary routes', async () => {
    process.env.PUBLIC_API_ENABLED = 'false';
    await request(server()).get(`${dictionary}/glimmer/datasets`).expect(404);
    await request(server()).get(`${free}/glimmer/datasets`).expect(404);
    delete process.env.PUBLIC_API_ENABLED;
    process.env.PUBLIC_API_RATE_LIMIT = '1/60';
    await request(server()).get(`${dictionary}/glimmer/datasets`).expect(429);
    const limited = await request(server()).get(`${free}/glimmer/datasets`).expect(429);
    expect(limited.headers['content-type']).toContain('text/plain');
    expect(limited.headers['retry-after']).toBeDefined();
    await request(server()).get('/api/v1/words/glimmer').expect(429);
    process.env.INTERNAL_API_TOKEN = 'compatibility-fixture-token';
    await request(server())
      .get(`${dictionary}/glimmer/datasets`)
      .set('X-Internal-Token', process.env.INTERNAL_API_TOKEN)
      .expect(200);
  });
});
