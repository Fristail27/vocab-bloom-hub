import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import { getVersion } from '../configuration';

/**
 * GET /api/settings/update-check (issue #477): admin-only, the running version
 * against GitHub's latest stable release, silent with UPDATE_CHECK=false.
 * GitHub is never called from the suite: `fetch` is replaced.
 */
describe('Update check (e2e, issue #477)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();
  const auth: Record<string, string> = {};
  const realFetch = global.fetch;
  const fetchMock = jest.fn();
  const savedFlag = process.env.UPDATE_CHECK;

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const hashByEnv = await hashLoginString('e2e-admin', 'e2e-password');
    const secretHash = await hashLoginString('e2e-admin', hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;
  });

  beforeEach(async () => {
    delete process.env.UPDATE_CHECK;
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    global.fetch = realFetch;
    if (savedFlag === undefined) delete process.env.UPDATE_CHECK;
    else process.env.UPDATE_CHECK = savedFlag;
  });

  it('is behind the admin guard', async () => {
    await request(server()).get('/api/settings/update-check').expect(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a newer release, and is not shadowed by the by-field route', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v999.0.0',
        html_url: 'https://github.com/Fristail27/vocab-bloom-hub/releases/tag/v999.0.0',
      }),
    });

    const res = await request(server()).get('/api/settings/update-check').set(auth).expect(200);
    expect(res.body).toMatchObject({
      enabled: true,
      current: getVersion(),
      latest: '999.0.0',
      update_available: true,
      release_url: 'https://github.com/Fristail27/vocab-bloom-hub/releases/tag/v999.0.0',
    });
    expect(typeof res.body.checked_at).toBe('string');
    // an admin answer is never cached by anything in between
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('answers "unknown" when GitHub does not', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const res = await request(server()).get('/api/settings/update-check').set(auth).expect(200);
    expect(res.body).toMatchObject({ enabled: true, latest: null, update_available: false, release_url: null });
  });

  it('makes no outgoing request with UPDATE_CHECK=false', async () => {
    process.env.UPDATE_CHECK = 'false';

    const res = await request(server()).get('/api/settings/update-check').set(auth).expect(200);
    expect(res.body).toEqual({
      enabled: false,
      current: getVersion(),
      latest: null,
      update_available: false,
      release_url: null,
      checked_at: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
