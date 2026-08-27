import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { PublicOpenApiService } from '../src/modules/PublicApiModule/public-openapi.service';

const COMMITTED_SPEC = resolve(__dirname, '../openapi/public-v1.json');

// A document without its version: the served one and the committed one are
// built by the same code, but package.json is read relative to the working
// directory, which differs between `yarn test` (root) and the generator
const withoutVersion = (document: OpenAPIObject) => ({ ...document, info: { ...document.info, version: '' } });

// The machine-readable public contract (issue #273): served from the running
// server in every environment and identical to the committed spec
describe('GET /api/v1/openapi.json (e2e, issue #273)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 503 in the public error shape until the bootstrap attaches the application', async () => {
    const res = await request(server()).get('/api/v1/openapi.json').expect(503);
    expect(res.body).toEqual({ statusCode: 503, message: 'openapi_not_available', error: true });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('serves the public contract with the caching headers of the prefix', async () => {
    app.get(PublicOpenApiService).attach(app);

    const res = await request(server()).get('/api/v1/openapi.json').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['x-api-version']).toBe('1');
    expect(res.headers.etag).toMatch(/^W\/"/);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');

    const document = res.body as OpenAPIObject;
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('VocabBloom Public API');

    const paths = Object.keys(document.paths);
    expect(paths.every((path) => path.startsWith('/api/v1/'))).toBe(true);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/search',
        '/api/v1/search/detailed',
        '/api/v1/words',
        '/api/v1/words/{word}',
        '/api/v1/words/{word}/meanings',
        '/api/v1/words/{word}/translations',
        '/api/v1/words/{word}/forms',
        '/api/v1/words/id/{id}',
        '/api/v1/random',
        '/api/v1/meta',
        '/api/v1/openapi.json',
      ]),
    );
    expect(paths).not.toContain('/api/en/search');
    expect(document.components).not.toHaveProperty('securitySchemes');
    // the list filters are documented as query parameters with their enums
    const listParams = document.paths['/api/v1/words'].get?.parameters as Array<{ name: string; in: string }>;
    expect(listParams.map((p) => p.name)).toEqual(
      expect.arrayContaining(['part_of_speech', 'word_level', 'cursor', 'limit', 'with_meanings']),
    );
    expect(listParams.every((p) => p.in === 'query')).toBe(true);

    // the scan runs once; a second request reuses it and revalidates
    await request(server()).get('/api/v1/openapi.json').set('If-None-Match', res.headers.etag).expect(304);
  });

  it('matches the committed openapi/public-v1.json (run `yarn workspace server openapi:generate` after a contract change)', async () => {
    const committed = JSON.parse(readFileSync(COMMITTED_SPEC, 'utf8')) as OpenAPIObject;
    const res = await request(server()).get('/api/v1/openapi.json').expect(200);
    expect(withoutVersion(res.body as OpenAPIObject)).toEqual(withoutVersion(committed));
  });
});
