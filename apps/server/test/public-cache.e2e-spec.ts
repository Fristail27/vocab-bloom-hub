import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import { EnAreaVariantsE, EnPartOfSpeechE, EnWordFormsE } from '../types';

const E2E_USERNAME = 'e2e-admin';
const E2E_PASSWORD = 'e2e-password';

const ENV_KEYS = ['PUBLIC_API_ENABLED', 'ADMIN_API_ENABLED', 'PUBLIC_API_CACHE_MAX_AGE'] as const;

const WEAK_ETAG = /^W\/"[A-Za-z0-9_-]+"$/;

// Caching headers of the public prefix (issue #274): ETag + 304 round trips,
// Cache-Control from PUBLIC_API_CACHE_MAX_AGE, Last-Modified, and no-store
// on the admin surface and on public errors. The whole AppModule is booted
// so the surface middleware and the error filter take part.
describe('public API caching headers (e2e, issue #274)', () => {
  let app: INestApplication<App>;
  let wordId: number;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(async () => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
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

    const added = await request(server())
      .post('/api/en/add/word')
      .set(auth)
      .send({
        word: 'glimmer',
        part_of_speech: EnPartOfSpeechE.verb,
        form_of_word: EnWordFormsE.base_form,
        meanings: [
          {
            title: 'to shine faintly',
            definition: 'to shine with a faint, unsteady light',
            is_obsolete: false,
            sort_order: 1,
            examples: [],
            area_variant: EnAreaVariantsE.common,
            translations: [],
          },
        ],
      })
      .expect(201);
    wordId = (added.body as { id: number }).id;
  });

  afterAll(async () => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await app.close();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('stamps every public GET with ETag, Cache-Control and Last-Modified', async () => {
    const res = await request(server()).get('/api/v1/words/glimmer').expect(200);
    expect(res.headers.etag).toMatch(WEAK_ETAG);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.headers['x-api-version']).toBe('1');

    const lastModified = Date.parse(res.headers['last-modified']);
    expect(Number.isNaN(lastModified)).toBe(false);
    expect(lastModified).toBeLessThanOrEqual(Date.now());
    // an HTTP date has whole seconds; the header must survive the round trip as is
    expect(new Date(lastModified).toUTCString()).toBe(res.headers['last-modified']);

    // the same data hashes to the same tag on every route that serves it
    const again = await request(server()).get('/api/v1/words/glimmer').expect(200);
    expect(again.headers.etag).toBe(res.headers.etag);
    const meta = await request(server()).get('/api/v1/meta').expect(200);
    expect(meta.headers.etag).toMatch(WEAK_ETAG);
    expect(meta.headers.etag).not.toBe(res.headers.etag);
  });

  it('answers 304 without a body to a matching If-None-Match or If-Modified-Since', async () => {
    const first = await request(server()).get(`/api/v1/words/id/${wordId}`).expect(200);

    const notModified = await request(server())
      .get(`/api/v1/words/id/${wordId}`)
      .set('If-None-Match', first.headers.etag)
      .expect(304);
    expect(notModified.text).toBe('');
    expect(notModified.headers.etag).toBe(first.headers.etag);
    expect(notModified.headers['cache-control']).toBe('public, max-age=3600');
    expect(notModified.headers['x-api-version']).toBe('1');

    await request(server())
      .get(`/api/v1/words/id/${wordId}`)
      .set('If-Modified-Since', first.headers['last-modified'])
      .expect(304);

    // a tag of some other version keeps the full answer
    const other = await request(server())
      .get(`/api/v1/words/id/${wordId}`)
      .set('If-None-Match', 'W/"somebody-elses-tag"')
      .expect(200);
    expect(other.body.data.word).toBe('glimmer');

    // the list and the meta endpoint revalidate the same way
    const list = await request(server()).get('/api/v1/words?limit=5').expect(200);
    await request(server()).get('/api/v1/words?limit=5').set('If-None-Match', list.headers.etag).expect(304);
    const meta = await request(server()).get('/api/v1/meta').expect(200);
    await request(server()).get('/api/v1/meta').set('If-None-Match', meta.headers.etag).expect(304);
  });

  it('changes the ETag as soon as the data changes', async () => {
    const before = await request(server()).get('/api/v1/words/glimmer').expect(200);

    await request(server())
      .patch(`/api/en/common-info/${wordId}`)
      .set(auth)
      .send({ description: 'to shine faintly or unsteadily' })
      .expect(200);

    const after = await request(server())
      .get('/api/v1/words/glimmer')
      .set('If-None-Match', before.headers.etag)
      .expect(200);
    expect(after.headers.etag).toMatch(WEAK_ETAG);
    expect(after.headers.etag).not.toBe(before.headers.etag);
    expect(after.body.data[0].description).toBe('to shine faintly or unsteadily');
    await request(server()).get('/api/v1/words/glimmer').set('If-None-Match', after.headers.etag).expect(304);
  });

  it('sizes Cache-Control by PUBLIC_API_CACHE_MAX_AGE, read per request', async () => {
    process.env.PUBLIC_API_CACHE_MAX_AGE = '120';
    const custom = await request(server()).get('/api/v1/random').expect(200);
    expect(custom.headers['cache-control']).toBe('public, max-age=120');

    process.env.PUBLIC_API_CACHE_MAX_AGE = '0';
    const revalidate = await request(server()).get('/api/v1/random').expect(200);
    expect(revalidate.headers['cache-control']).toBe('public, no-cache');
    expect(revalidate.headers.etag).toMatch(WEAK_ETAG);
  });

  it('caches the GET search like every other public GET (issue #396)', async () => {
    const res = await request(server()).get('/api/v1/search?search=glim').expect(200);
    expect(res.headers.etag).toMatch(WEAK_ETAG);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(Number.isNaN(Date.parse(res.headers['last-modified']))).toBe(false);
    await request(server())
      .get('/api/v1/search?search=glim')
      .set('If-None-Match', res.headers.etag)
      .expect(304);
    const detailed = await request(server())
      .get('/api/v1/search/detailed?search=glim&with_meanings=true')
      .expect(200);
    expect(detailed.headers.etag).toMatch(WEAK_ETAG);
    expect(detailed.headers['cache-control']).toBe('public, max-age=3600');
  });

  it('leaves the POST search reads without caching directives', async () => {
    const res = await request(server()).post('/api/v1/search').send({ search: 'glim' }).expect(200);
    expect(res.headers['cache-control']).toBeUndefined();
    expect(res.headers['last-modified']).toBeUndefined();
  });

  it('marks public errors no-store', async () => {
    const missing = await request(server()).get('/api/v1/words/nope').expect(404);
    expect(missing.headers['cache-control']).toBe('no-store');
    expect(missing.headers['x-api-version']).toBe('1');
    const invalid = await request(server()).get('/api/v1/words?limit=0').expect(400);
    expect(invalid.headers['cache-control']).toBe('no-store');
  });

  it('marks everything under the admin prefixes no-store', async () => {
    const detail = await request(server()).get(`/api/en/${wordId}`).set(auth).expect(200);
    expect(detail.headers['cache-control']).toBe('no-store');
    expect(detail.headers['last-modified']).toBeUndefined();
    const denied = await request(server()).get(`/api/en/${wordId}`).expect(401);
    expect(denied.headers['cache-control']).toBe('no-store');
    const token = await request(server()).get('/api/auth/check-token').expect(200);
    expect(token.headers['cache-control']).toBe('no-store');
    const settings = await request(server()).get('/api/settings/all').set(auth).expect(200);
    expect(settings.headers['cache-control']).toBe('no-store');

    process.env.ADMIN_API_ENABLED = 'false';
    const hidden = await request(server()).get(`/api/en/${wordId}`).set(auth).expect(404);
    expect(hidden.headers['cache-control']).toBe('no-store');
  });
});
