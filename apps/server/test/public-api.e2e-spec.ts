import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import { EnPartOfSpeechE, EnWordFormsE } from '../types';

const E2E_USERNAME = 'e2e-admin';
const E2E_PASSWORD = 'e2e-password';

const ENV_KEYS = ['PUBLIC_API_ENABLED', 'ADMIN_API_ENABLED', 'PUBLIC_API_RATE_LIMIT'] as const;

// The public, read-only prefix (issue #271): no auth, the { data, meta }
// envelope, one error shape, the version header, the rate limit and the
// PUBLIC_API_ENABLED / ADMIN_API_ENABLED switches. The whole AppModule is
// booted so the surface middleware and the global filter are in place.
describe('public API /api/v1 (e2e, issue #271)', () => {
  let app: INestApplication<App>;
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
    // the throttler keys its counters by client ip: trusting X-Forwarded-For
    // lets each scenario below run with an ip of its own
    (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set('trust proxy', true);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();

    await request(server())
      .post('/api/en/add/word')
      .set(auth)
      .send({
        word: 'flicker',
        part_of_speech: EnPartOfSpeechE.verb,
        form_of_word: EnWordFormsE.base_form,
        meanings: [
          {
            title: 'to shine unsteadily',
            definition: 'to burn or shine with an unsteady light',
            is_obsolete: false,
            sort_order: 1,
            examples: [],
            area_variant: 'common',
            translations: [],
          },
        ],
      })
      .expect(201);
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

  it('answers the search without auth, in the { data, meta } envelope, with the version header', async () => {
    const res = await request(server()).post('/api/v1/search').send({ search: 'flick' }).expect(200);
    expect(res.headers['x-api-version']).toBe('1');
    expect(res.body.meta).toEqual({ count: 1, fuzzy: false, short_term: false });
    expect(res.body.data).toEqual([expect.objectContaining({ word: 'flicker' })]);

    const detailed = await request(server())
      .post('/api/v1/search/detailed')
      .send({ search: 'flicker', with_meanings: true })
      .expect(200);
    expect(detailed.headers['x-api-version']).toBe('1');
    expect(detailed.body.meta).toEqual({
      page: 1,
      limit: 10,
      has_more: false,
      fuzzy: false,
      short_term: false,
    });
    expect(detailed.body.data[0].meanings).toEqual([expect.objectContaining({ title: 'to shine unsteadily' })]);
  });

  it('rejects an empty and an oversized search term (issue #345)', async () => {
    await request(server()).post('/api/v1/search').send({ search: '' }).expect(400);
    const long = await request(server())
      .post('/api/v1/search')
      .send({ search: 'x'.repeat(257) })
      .expect(400);
    expect(long.body).toEqual({ statusCode: 400, message: expect.stringContaining('256'), error: true });
    await request(server())
      .post('/api/v1/search/detailed')
      .send({ search: 'x'.repeat(257) })
      .expect(400);
  });

  it('reports every error under the prefix in the ErrorResT shape', async () => {
    // validation
    const bad = await request(server()).post('/api/v1/search').send({ search: 'x', limit: 'many' }).expect(400);
    expect(bad.headers['x-api-version']).toBe('1');
    expect(bad.body).toEqual({ statusCode: 400, message: expect.stringContaining('limit'), error: true });
    // unknown route
    const missing = await request(server()).get('/api/v1/nope').expect(404);
    expect(missing.headers['x-api-version']).toBe('1');
    expect(missing.body).toEqual({ statusCode: 404, message: expect.any(String), error: true });
    // the admin prefixes keep Nest's default error body
    const admin = await request(server()).get('/api/en/check-word/run').expect(401);
    expect(admin.headers['x-api-version']).toBeUndefined();
    expect(admin.body.error).not.toBe(true);
  });

  it('rate-limits the whole prefix per PUBLIC_API_RATE_LIMIT', async () => {
    process.env.PUBLIC_API_RATE_LIMIT = '2/60';
    // a fresh ip: the budget counts every request under the prefix, whichever route
    const ip = { 'X-Forwarded-For': '203.0.113.7' };
    await request(server()).post('/api/v1/search').set(ip).send({ search: 'a' }).expect(200);
    await request(server()).post('/api/v1/search/detailed').set(ip).send({ search: 'a' }).expect(200);
    const limited = await request(server()).post('/api/v1/search').set(ip).send({ search: 'a' }).expect(429);
    expect(limited.body).toEqual({ statusCode: 429, message: 'too_many_requests', error: true });
    expect(limited.headers['x-api-version']).toBe('1');
  });

  it('keeps the old search paths as deprecated aliases with the bare response', async () => {
    const res = await request(server()).post('/api/en/search').send({ search: 'flick' }).expect(201);
    expect(res.headers.deprecation).toBe('true');
    expect(res.headers.link).toBe('</api/v1/search>; rel="successor-version"');
    expect(res.body).toEqual([expect.objectContaining({ word: 'flicker' })]);

    const detailed = await request(server())
      .post('/api/en/search/detailed')
      .send({ search: 'flick' })
      .expect(201);
    expect(detailed.headers.deprecation).toBe('true');
    expect(detailed.body).toEqual({
      items: expect.any(Array),
      page: 1,
      limit: 10,
      has_more: false,
      fuzzy: false,
      short_term: false,
    });
  });

  it('hides the public prefix when PUBLIC_API_ENABLED=false', async () => {
    process.env.PUBLIC_API_ENABLED = 'false';
    const res = await request(server()).post('/api/v1/search').send({ search: 'flick' }).expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: expect.any(String), error: true });
    // the admin surface is untouched
    await request(server()).get('/api/auth/check-token').expect(200);
  });

  it('hides the admin surface when ADMIN_API_ENABLED=false', async () => {
    process.env.ADMIN_API_ENABLED = 'false';
    await request(server()).get('/api/auth/check-token').expect(404);
    await request(server()).get('/api/en/check-word/run').set(auth).expect(404);
    await request(server()).get('/api/settings/all').set(auth).expect(404);
    // the public prefix keeps answering
    await request(server())
      .post('/api/v1/search')
      .set({ 'X-Forwarded-For': '203.0.113.8' })
      .send({ search: 'flick' })
      .expect(200);
  });
});
