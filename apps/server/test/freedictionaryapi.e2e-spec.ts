import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { checkIsPostgres } from '../configuration';
import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { apiCorsOptions } from '../src/core/utils/api-cors';
import { weakEtagOf } from '../src/core/utils/http-cache';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { replaceAlternatives } from '../src/modules/EnModule/utils/entryAlternatives';

const base = '/api/compat/freedictionaryapi/v1';
const keys = ['PUBLIC_API_ENABLED', 'PUBLIC_API_RATE_LIMIT', 'INTERNAL_API_TOKEN'] as const;

describe('freedictionaryapi.com HTTP contract (#581)', () => {
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
    for (const word of ['glimmer', 'Polish', 'polish', 'take flight', 'literal%20word']) {
      await request(server())
        .post('/api/en/add/word')
        .set(auth)
        .send({
          word,
          part_of_speech: 'verb',
          form_of_word: 'base_form',
          transcription: '/fixture/',
          ...(word === 'glimmer' && {
            forms: [
              {
                word: 'glimmered',
                form_of_word: 'past_simple',
                area_variant: 'common',
                transcription: '/form/',
              },
            ],
          }),
          meanings: [
            {
              title: 'Fixture',
              definition: 'An original definition.',
              is_obsolete: false,
              sort_order: 1,
              area_variant: 'common',
              examples: ['First example.', 'Second example.'],
              quotes: [
                {
                  text: 'Original quote.',
                  reference: 'Fixture author',
                  source_url: 'https://example.org/quote',
                },
              ],
              translations: [
                {
                  language: 'ru',
                  title: 'Meaning title',
                  definition: 'Description',
                  variants_of_words: ['слово', 'вариант'],
                },
              ],
            },
          ],
        })
        .expect(201);
    }
    // A real EnEntry spelling link with no EnWord on its alternative end.
    const db = app.get(DataSource);
    await db.getRepository(EnEntry).save([{ word: 'glymmer' }, { word: 'unlinked-placeholder' }]);
    await replaceAlternatives(
      db.manager,
      new Map([
        ['glimmer', ['glymmer']],
        ['Polish', ['polish']],
      ]),
    );
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

  it('returns the published shape and keeps translations omitted by default', async () => {
    const res = await request(server()).get(`${base}/entries/en/glimmer`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json; charset=utf-8/);
    expect(res.body.word).toBe('glimmer');
    expect(res.body.entries[0]).toMatchObject({
      language: { code: 'en', name: 'English' },
      partOfSpeech: 'verb',
      pronunciations: [{ type: 'ipa', text: '/fixture/', tags: [] }],
      forms: [
        { word: 'glimmered', tags: ['past'] },
        { word: 'glymmer', tags: ['alternative'] },
      ],
      senses: [
        {
          definition: 'An original definition.',
          examples: ['First example.', 'Second example.'],
          quotes: [{ text: 'Original quote.', reference: 'Fixture author https://example.org/quote' }],
          subsenses: [],
        },
      ],
      vocabBloom: { dataset: 'default', word: 'glimmer', source: 'vocab-bloom-hub', modified: true },
    });
    expect(res.body.entries[0].senses[0]).not.toHaveProperty('translations');
    expect(res.body.source.license.name).not.toBe('CC BY-SA 4.0');
    expect(res.body.vocabBloom.dataset).toBe('default');
    expect(res.body.entries[0].vocabBloom.origins.length).toBeGreaterThan(0);
  });

  it('includes supported lexical translations only when requested; first duplicate wins', async () => {
    for (const query of ['translations=true', 'translations=true&translations=false']) {
      const res = await request(server()).get(`${base}/entries/en/glimmer?${query}`).expect(200);
      expect(res.body.entries[0].senses[0].translations).toEqual([
        { language: { code: 'ru', name: 'Russian' }, word: 'вариант' },
        { language: { code: 'ru', name: 'Russian' }, word: 'слово' },
      ]);
    }
    for (const query of ['translations=false', 'translations=false&translations=true']) {
      const res = await request(server()).get(`${base}/entries/en/glimmer?${query}`).expect(200);
      expect(res.body.entries[0].senses[0]).not.toHaveProperty('translations');
    }
  });

  it('uses exact case, preserves whitespace, and decodes a path segment once', async () => {
    for (const word of ['Polish', 'polish', 'take flight', 'literal%20word']) {
      const res = await request(server())
        .get(`${base}/entries/en/${encodeURIComponent(word)}`)
        .expect(200);
      expect(res.body.word).toBe(word);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].vocabBloom.word).toBe(word);
    }
    for (const word of ['GLIMMER', ' glimmer ', 'absent']) {
      const res = await request(server())
        .get(`${base}/entries/en/${encodeURIComponent(word)}`)
        .expect(200);
      expect(res.body.word).toBe(word);
      expect(res.body.entries).toEqual([]);
    }
  });

  it('all means English only, unsupported languages have empty entries, and languages counts spellings once', async () => {
    const en = await request(server()).get(`${base}/entries/en/glimmer`).expect(200);
    const all = await request(server()).get(`${base}/entries/all/glimmer`).expect(200);
    expect(all.body).toEqual(en.body);
    for (const language of ['ru', 'zz', 'EN', 'ALL', 'en_US']) {
      const res = await request(server()).get(`${base}/entries/${language}/glimmer`).expect(200);
      expect(res.body.entries).toEqual([]);
    }
    const languages = await request(server()).get(`${base}/languages?translations=invalid`).expect(200);
    expect(languages.body).toEqual([{ code: 'en', name: 'English', words: 7 }]);
  });

  it('resolves alternative-only entry links and inflections without conflating their forms', async () => {
    const alias = await request(server()).get(`${base}/entries/en/glymmer`).expect(200);
    expect(alias.body.word).toBe('glymmer');
    expect(alias.body.entries[0].vocabBloom.word).toBe('glimmer');
    expect(alias.body.entries[0].forms).toContainEqual({ word: 'glimmer', tags: ['canonical'] });
    const form = await request(server()).get(`${base}/entries/en/glimmered`).expect(200);
    expect(form.body.entries[0].pronunciations[0].text).toBe('/form/');
    expect(form.body.entries[0].forms).toContainEqual({ word: 'glymmer', tags: ['alternative'] });
  });

  it('retains mixed source terms and never replaces them with a Wiktionary license', async () => {
    const repository = app.get(DataSource).getRepository(EnWord);
    const row = await repository
      .createQueryBuilder('w')
      .innerJoin('w.word', 'entry')
      .where('entry.word = :word', { word: 'glimmer' })
      .getOneOrFail();
    const original = row.origins;
    const fixture = {
      id: 'fixture-source',
      name: 'Original fixture',
      version: null,
      record_url: 'https://example.org/fixture',
      attribution: 'Original author',
      notices: ['Preserve this notice'],
      license_relation: 'any' as const,
      scope: 'word' as const,
      method: 'manual' as const,
      recorded_at: null,
      inherited: false,
      licenses: [
        { name: 'Custom terms', url: '', text: 'Full custom text' },
        { name: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
      ],
    };
    try {
      await repository.save({ ...row, origins: [fixture] });
      const response = await request(server()).get(`${base}/entries/en/glimmer`).expect(200);
      expect(response.body.source.license.name).toBe('Multiple licenses — see vocabBloom terms');
      expect(response.body.source.license.url).toContain('/api/v1/words/glimmer/datasets');
      expect(response.body.entries[0].vocabBloom.origins).toContainEqual(fixture);
      expect(response.body.entries[0].vocabBloom.licenses).toEqual(
        expect.arrayContaining([{ ...fixture.licenses[0], origin_id: fixture.id }]),
      );
      await repository.save({ ...row, origins: [{ ...fixture, licenses: [] }] });
      const unknown = await request(server()).get(`${base}/entries/en/glimmer`).expect(200);
      expect(unknown.body.source.license.name).toBe('License information unavailable');
      expect(unknown.body.entries[0].vocabBloom.origins[0].notices).toEqual(fixture.notices);
    } finally {
      await repository.save({ ...row, origins: original });
    }
  });

  it('validates strict booleans with upstream plain-text errors and ignores unrelated options', async () => {
    for (const name of ['translations', 'pretty'])
      for (const value of ['1', '0', 'yes', 'TRUE', '']) {
        const res = await request(server()).get(`${base}/entries/en/glimmer?${name}=${value}`).expect(400);
        expect(res.headers['content-type']).toMatch(/text\/plain/);
        expect(res.text).toBe(
          `failed to parse parameter \`${name}\`: failed to parse "boolean": provided string was not \`true\` or \`false\` (occurred while parsing "optional_boolean")`,
        );
        expect(res.headers['cache-control']).toBe('no-store');
      }
    await request(server()).get(`${base}/entries/en/glimmer?foo=1`).expect(200);
    await request(server()).get(`${base}/entries/en/glimmer?dataset=other`).expect(400);
    await request(server())
      .get(`${base}/entries/en/${'x'.repeat(129)}`)
      .expect(400);
  });

  it('formats per response, hashes the bytes sent, revalidates and supports HEAD without affecting native JSON', async () => {
    for (const path of ['/entries/en/glimmer', '/languages']) {
      const compact = await request(server())
        .get(base + path)
        .expect(200);
      const pretty = await request(server())
        .get(base + path + '?pretty=true')
        .expect(200);
      expect(pretty.body).toEqual(compact.body);
      expect(pretty.text).toBe(JSON.stringify(compact.body, null, 2));
      expect(compact.text).toBe(JSON.stringify(compact.body));
      expect(pretty.headers.etag).toBe(weakEtagOf(pretty.text));
      expect(pretty.headers.etag).not.toBe(compact.headers.etag);
      await request(server())
        .get(base + path + '?pretty=true')
        .set('If-None-Match', pretty.headers.etag)
        .expect(304);
      await request(server())
        .get(base + path + '?pretty=true')
        .set('If-None-Match', compact.headers.etag)
        .expect(200);
      const head = await request(server())
        .head(base + path + '?pretty=true')
        .expect(200);
      expect(head.headers.etag).toBe(pretty.headers.etag);
    }
    const native = await request(server()).get('/api/v1/words/glimmer').expect(200);
    expect(native.text).toBe(JSON.stringify(native.body));
  });

  it('allows anonymous cross-origin reads and is hidden by the public-surface switch', async () => {
    const res = await request(server())
      .get(`${base}/entries/en/glimmer`)
      .set('Origin', 'https://reader.example')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['x-api-version']).toBeUndefined();
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['last-modified']).toBeDefined();
    await request(server())
      .options(`${base}/languages`)
      .set('Origin', 'https://reader.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    process.env.PUBLIC_API_ENABLED = 'false';
    const hidden = await request(server()).get(`${base}/languages`).expect(404);
    expect(hidden.headers['content-type']).toMatch(/text\/plain/);
  });

  (checkIsPostgres() ? it : it.skip)(
    'keeps data, counts and licenses isolated when the active dataset changes',
    async () => {
      await request(server())
        .post('/api/en/datasets')
        .set(auth)
        .send({
          name: 'free_fixture',
          title: 'Test dataset',
          license: {
            name: 'Fixture terms',
            url: 'https://example.org/terms',
            text: 'Keep this original notice.',
          },
          attribution: 'Test author',
        })
        .expect(201);
      await request(server()).post('/api/en/datasets/free_fixture/activate').set(auth).expect(200);
      try {
        const empty = await request(server()).get(`${base}/entries/en/glimmer`).expect(200);
        expect(empty.body.entries).toEqual([]);
        expect(empty.body.source.license.name).toBe('Fixture terms');
        expect(empty.body.vocabBloom.license_text).toBe('Keep this original notice.');
        const languages = await request(server()).get(`${base}/languages`).expect(200);
        expect(languages.body).toEqual([{ code: 'en', name: 'English', words: 0 }]);
        await request(server())
          .post('/api/en/add/word')
          .set(auth)
          .send({ word: 'glimmer', part_of_speech: 'noun', form_of_word: 'base_form' })
          .expect(201);
        const word = await request(server()).get(`${base}/entries/en/glimmer`).expect(200);
        expect(word.body.entries[0].vocabBloom.source).toBe('free_fixture');
        expect(word.body.source.license.url).toBe('https://example.org/terms');
      } finally {
        await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
      }
    },
  );

  it('shares the rate budget with both native and dictionaryapi.dev routes', async () => {
    process.env.PUBLIC_API_RATE_LIMIT = '1/60';
    const limited = await request(server()).get(`${base}/languages`).expect(429);
    expect(limited.headers['content-type']).toMatch(/text\/plain/);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.headers['cache-control']).toBe('no-store');
    await request(server()).get('/api/v1/words/glimmer').expect(429);
    await request(server()).get('/api/compat/dictionaryapi/v2/entries/en/glimmer').expect(429);
    process.env.INTERNAL_API_TOKEN = 'fixture-internal-token';
    await request(server())
      .get(`${base}/entries/en/glimmer`)
      .set('X-Internal-Token', 'fixture-internal-token')
      .expect(200);
  });
});
