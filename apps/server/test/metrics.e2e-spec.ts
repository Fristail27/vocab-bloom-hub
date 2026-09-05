import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';

const ENV_KEYS = ['METRICS_ENABLED', 'METRICS_PATH'] as const;

/**
 * The Prometheus endpoint (issue #281): off by default, the exposition at
 * METRICS_PATH when on, HTTP series by route template (404s included) and
 * the domain series the services report.
 */
describe('Prometheus metrics (e2e, issue #281)', () => {
  let app: INestApplication<App>;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  const boot = async (env: Partial<Record<(typeof ENV_KEYS)[number], string>>) => {
    for (const key of ENV_KEYS) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const hashByEnv = await hashLoginString('e2e-admin', 'e2e-password');
    const secretHash = await hashLoginString('e2e-admin', hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();
  };

  beforeAll(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
  });

  afterEach(async () => {
    await app?.close();
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('is not served unless METRICS_ENABLED is on', async () => {
    await boot({});
    await request(server()).get('/metrics').expect(404);
  });

  it('serves the exposition at METRICS_PATH with process, HTTP and domain series', async () => {
    await boot({ METRICS_ENABLED: 'true', METRICS_PATH: '/internal/metrics' });
    await request(server()).get('/metrics').expect(404);

    await request(server())
      .post('/api/en/add/word')
      .set(auth)
      .send({
        word: 'run',
        part_of_speech: 'verb',
        form_of_word: 'base_form',
        meanings: [
          {
            title: 't',
            definition: 'd',
            is_obsolete: false,
            sort_order: 1,
            examples: [],
            area_variant: 'common',
            translations: [],
          },
        ],
      })
      .expect(201);
    await request(server()).get('/api/v1/words/run').expect(200);
    await request(server()).get('/api/v1/words/nonexistent').expect(404);
    await request(server()).get('/no/such/route').expect(404);
    await request(server()).post('/api/v1/search').send({ search: 'run' }).expect(200);
    await request(server()).post('/api/v1/search').send({ search: 'qzxvjwq' }).expect(200);

    const res = await request(server()).get('/internal/metrics').expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['cache-control']).toBe('no-store');
    const text = res.text;

    // default process metrics and the build info; the database label follows
    // the driver the suite runs on (Postgres in CI's postgres job, issue #400)
    const database = process.env.DATABASE_URL?.startsWith('postgres') ? 'postgres' : 'sqlite';
    expect(text).toMatch(
      new RegExp(`^vbh_build_info\\{version="\\d+\\.\\d+\\.\\d+[^"]*",database="${database}"\\} 1$`, 'm'),
    );
    expect(text).toMatch(/^process_cpu_seconds_total /m);
    expect(text).toMatch(/^nodejs_eventloop_lag_seconds /m);

    // HTTP series by route template: the headword read twice (200 + 404), the miss as "unmatched"
    expect(text).toMatch(
      /^http_requests_total\{method="GET",route="\/api\/v1\/words\/:word",status="200"\} 1$/m,
    );
    expect(text).toMatch(
      /^http_requests_total\{method="GET",route="\/api\/v1\/words\/:word",status="404"\} 1$/m,
    );
    // two misses: /no/such/route and the /metrics probe above (the path is /internal/metrics here)
    expect(text).toMatch(/^http_requests_total\{method="GET",route="unmatched",status="404"\} 2$/m);
    expect(text).toMatch(
      /^http_request_duration_seconds_count\{method="POST",route="\/api\/en\/add\/:entryType",status="201"\} 1$/m,
    );
    expect(text).not.toMatch(/route="\/api\/v1\/words\/run"/);
    expect(text).not.toMatch(/route="\/internal\/metrics"/);
    expect(text).toMatch(/^http_requests_in_flight 1$/m);

    // the search tiers: one exact hit, one search nothing matched
    expect(text).toMatch(/^vbh_search_tier_hits_total\{tier="exact",short_term="false"\} 1$/m);
    expect(text).toMatch(/^vbh_search_tier_hits_total\{tier="none",short_term="false"\} 1$/m);

    // the dictionary size, refreshed at scrape time
    expect(text).toMatch(/^vbh_dictionary_size\{kind="words"\} 1$/m);
    expect(text).toMatch(/^vbh_dictionary_size\{kind="meanings"\} 1$/m);
    // nothing running, nothing finished
    expect(text).not.toMatch(/^vbh_dictionary_transfers_total/m);
  });

  it('counts a dictionary export as a finished transfer', async () => {
    await boot({ METRICS_ENABLED: 'true' });
    const stream = await request(server()).get('/api/en/dictionary/export').set(auth).expect(200);
    expect(stream.text).toContain('"stage":5');
    const text = (await request(server()).get('/metrics').expect(200)).text;
    expect(text).toMatch(/^vbh_dictionary_transfers_total\{kind="export",result="success"\} 1$/m);
    expect(text).toMatch(/^vbh_dictionary_transfer_in_progress\{kind="export"\} 0$/m);
  });
});
