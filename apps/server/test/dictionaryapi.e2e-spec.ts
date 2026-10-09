import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { checkIsPostgres } from '../configuration';
import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { apiCorsOptions } from '../src/core/utils/api-cors';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';

const base = '/api/compat/dictionaryapi';
const missing = {
  title: 'No Definitions Found',
  message: "Sorry pal, we couldn't find definitions for the word you were looking for.",
  resolution: 'You can try the search again at later time or head to the web instead.',
};
const keys = ['PUBLIC_API_ENABLED', 'PUBLIC_API_RATE_LIMIT', 'INTERNAL_API_TOKEN'] as const;

describe('dictionaryapi compatibility HTTP contract (#580)', () => {
  let app: INestApplication<App>;
  const auth = { Authorization: '' };
  const saved = new Map<string, string | undefined>();
  const server = () => app.getHttpServer();
  beforeAll(async () => {
    for (const key of keys) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
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
    for (const word of ['glimmer', 'take flight', 'percent%20literal', 'Polish', 'polish']) {
      await request(server())
        .post('/api/en/add/word')
        .set(auth)
        .send({
          word,
          part_of_speech: 'verb',
          form_of_word: 'base_form',
          transcription: '/fixture/',
          ...(word === 'glimmer' && {
            forms: [{ word: 'glimmered', form_of_word: 'past_simple', area_variant: 'common' }],
          }),
          meanings: [
            {
              title: 'A fixture',
              definition: 'An original fixture definition.',
              is_obsolete: false,
              sort_order: 1,
              examples: ['First example.', 'Second example.'],
              area_variant: 'common',
              translations: [],
            },
          ],
        })
        .expect(201);
    }
  });
  afterEach(() => {
    for (const key of keys) delete process.env[key];
  });
  afterAll(async () => {
    await app.close();
    for (const key of keys) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns v2 arrays and v1 maps from real stored entries, with provenance and no native envelope', async () => {
    const v2 = await request(server()).get(`${base}/v2/entries/en/glimmer`).expect(200);
    expect(v2.headers['content-type']).toMatch(/application\/json/);
    expect(v2.body).toHaveLength(1);
    expect(v2.body[0]).toMatchObject({
      word: 'glimmer',
      phonetic: '/fixture/',
      phonetics: [{ text: '/fixture/', audio: '' }],
      meanings: [
        {
          partOfSpeech: 'verb',
          synonyms: [],
          antonyms: [],
          definitions: [
            {
              definition: 'An original fixture definition.',
              example: 'First example.',
              synonyms: [],
              antonyms: [],
            },
          ],
        },
      ],
      vocabBloom: { source: 'vocab-bloom-hub', modified: true },
    });
    expect(v2.body[0].vocabBloom.origins.length).toBeGreaterThan(0);
    const v1 = await request(server()).get(`${base}/v1/entries/en/glimmer`).expect(200);
    const { meanings, ...rest } = v2.body[0];
    expect(v1.body).toEqual([{ ...rest, meaning: { verb: meanings[0].definitions } }]);
    expect(v2.headers['x-api-version']).toBeUndefined();
  });

  it('matches case-insensitively, supports English aliases, and decodes encoded words exactly once', async () => {
    const normal = await request(server()).get(`${base}/v2/entries/en/glimmer`).expect(200);
    for (const language of ['en', 'EN', 'en_US', 'en_GB']) {
      const upper = await request(server()).get(`${base}/v2/entries/${language}/GLIMMER`).expect(200);
      expect(upper.body).toEqual(normal.body);
    }
    for (const word of ['take flight', 'percent%20literal']) {
      const result = await request(server())
        .get(`${base}/v2/entries/en/${encodeURIComponent(word)}`)
        .expect(200);
      expect(result.body[0].word).toBe(word);
    }
  });

  it('preserves distinct capitalized headwords and uses native base-form resolution', async () => {
    for (const word of ['Polish', 'polish']) {
      const res = await request(server()).get(`${base}/v2/entries/en/${word}`).expect(200);
      expect(res.body.map((entry: { word: string }) => entry.word)).toEqual([word]);
    }
    const all = await request(server()).get(`${base}/v2/entries/en/POLISH`).expect(200);
    expect(all.body.map((entry: { word: string }) => entry.word).sort()).toEqual(['Polish', 'polish']);
    const form = await request(server()).get(`${base}/v2/entries/en/glimmered`).expect(200);
    expect(form.body[0].word).toBe('glimmer');
    expect(form.body[0].phonetic).toBe('/fixture/');
  });

  it('refuses dataset/query selectors rather than silently reading a different dataset', async () => {
    const bad = await request(server()).get(`${base}/v2/entries/en/glimmer?dataset=other`).expect(400);
    expect(bad.body.title).toBe('Invalid Request');
  });

  it('uses upstream missing-word errors for misses, unsupported languages and versions', async () => {
    for (const path of [
      '/v2/entries/en/not-in-fixture',
      '/v1/entries/en/not-in-fixture',
      '/v2/entries/zz/glimmer',
      '/v3/entries/en/glimmer',
    ]) {
      const result = await request(server())
        .get(base + path)
        .expect(404);
      expect(result.body).toEqual(missing);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.headers['content-type']).toMatch(/application\/json/);
    }
    const invalid = await request(server())
      .get(`${base}/v2/entries/en/${'a'.repeat(129)}`)
      .expect(400);
    expect(Object.keys(invalid.body).sort()).toEqual(['message', 'resolution', 'title']);
  });

  it('allows anonymous browser GETs and preflight from any origin, retaining admin CORS restrictions', async () => {
    for (const suffix of ['/v2/entries/en/glimmer', '/v2/entries/en/missing']) {
      const result = await request(server())
        .get(base + suffix)
        .set('Origin', 'https://reader.example');
      expect(result.headers['access-control-allow-origin']).toBe('*');
      expect(result.headers['access-control-allow-credentials']).toBeUndefined();
    }
    const preflight = await request(server())
      .options(`${base}/v2/entries/en/glimmer`)
      .set('Origin', 'https://reader.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('*');
    const admin = await request(server()).get('/api/en/search').set('Origin', 'https://reader.example');
    expect(admin.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('revalidates GET and HEAD, includes Last-Modified and respects the public surface switch', async () => {
    const first = await request(server()).get(`${base}/v2/entries/en/glimmer`).expect(200);
    expect(first.headers.etag).toMatch(/^W\//);
    expect(first.headers['cache-control']).toContain('public, max-age=');
    expect(Number.isFinite(Date.parse(first.headers['last-modified']))).toBe(true);
    await request(server())
      .get(`${base}/v2/entries/en/glimmer`)
      .set('If-None-Match', first.headers.etag)
      .expect(304);
    const head = await request(server()).head(`${base}/v2/entries/en/glimmer`).expect(200);
    expect(head.headers.etag).toBe(first.headers.etag);
    process.env.PUBLIC_API_ENABLED = 'false';
    const hidden = await request(server()).get(`${base}/v2/entries/en/glimmer`).expect(404);
    expect(hidden.body).toEqual(missing);
  });

  (checkIsPostgres() ? it : it.skip)(
    'reads only the active dataset and changes its terms and cache on activation',
    async () => {
      await request(server())
        .post('/api/en/datasets')
        .set(auth)
        .send({
          name: 'compat_fixture',
          title: 'Compatibility fixture',
          license: { spdx: 'CC0-1.0' },
          attribution: 'Original test data',
        })
        .expect(201);
      const before = await request(server()).get(`${base}/v2/entries/en/glimmer`).expect(200);
      await request(server()).post('/api/en/datasets/compat_fixture/activate').set(auth).expect(200);
      try {
        await request(server()).get(`${base}/v2/entries/en/glimmer`).expect(404);
        await request(server())
          .post('/api/en/add/word')
          .set(auth)
          .send({ word: 'glimmer', part_of_speech: 'noun', form_of_word: 'base_form' })
          .expect(201);
        const after = await request(server())
          .get(`${base}/v2/entries/en/glimmer`)
          .set('If-None-Match', before.headers.etag)
          .expect(200);
        expect(after.body).toHaveLength(1);
        expect(after.body[0].vocabBloom).toMatchObject({ dataset: 'compat_fixture', source: 'compat_fixture' });
        expect(after.body[0].meanings[0].partOfSpeech).toBe('noun');
        expect(after.body[0].vocabBloom.licenses[0].spdx).toBe('CC0-1.0');
        expect(after.headers.etag).not.toBe(before.headers.etag);
      } finally {
        await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
      }
    },
  );

  it('shares the native public rate budget across compatibility versions, with internal-token exemption', async () => {
    process.env.PUBLIC_API_RATE_LIMIT = '1/60';
    const limited = await request(server()).get(`${base}/v1/entries/en/glimmer`).expect(429);
    expect(limited.body.title).toBe('API Rate Limit Exceeded');
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.headers['cache-control']).toBe('no-store');
    await request(server()).get('/api/v1/words/glimmer').expect(429);
    process.env.INTERNAL_API_TOKEN = 'fixture-internal-token';
    await request(server())
      .get(`${base}/v2/entries/en/glimmer`)
      .set('X-Internal-Token', 'fixture-internal-token')
      .expect(200);
  });
});
