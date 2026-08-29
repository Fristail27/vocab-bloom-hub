import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { HealthService } from '../src/modules/HealthModule/health.service';
import { getVersion } from '../configuration';

const ENV_KEYS = ['PUBLIC_API_ENABLED', 'ADMIN_API_ENABLED'] as const;

/**
 * The probes of issue #315: liveness and readiness under /api, outside both
 * API surfaces, never cached; readiness fails while stopping or without
 * the database.
 */
describe('Health probes (e2e, issue #315)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  const boot = async (env: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) => {
    for (const key of ENV_KEYS) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
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

  it('GET /api/health answers 200 with the package version, uncached', async () => {
    await boot();
    const res = await request(server()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', version: getVersion() });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-api-version']).toBeUndefined();
  });

  it('GET /api/ready answers 200 while the database answers', async () => {
    await boot();
    const res = await request(server()).get('/api/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('GET /api/ready answers 503 once the database is gone', async () => {
    await boot();
    await app.get(DataSource).destroy();
    const res = await request(server()).get('/api/ready').expect(503);
    expect(res.body).toEqual({ status: 'error', reason: 'database_unreachable' });
  });

  it('GET /api/ready answers 503 as soon as a shutdown begins, /api/health stays 200', async () => {
    await boot();
    // the first hook Nest runs on SIGTERM, before the listener closes
    app.get(HealthService).onModuleDestroy();
    const res = await request(server()).get('/api/ready').expect(503);
    expect(res.body).toEqual({ status: 'error', reason: 'shutting_down' });
    await request(server()).get('/api/health').expect(200);
  });

  it('the probes need no login and survive both surface switches', async () => {
    await boot({ PUBLIC_API_ENABLED: 'false' });
    await request(server()).get('/api/health').expect(200);
    await request(server()).get('/api/ready').expect(200);
    await request(server()).get('/api/v1/meta').expect(404);
    await app.close();

    await boot({ ADMIN_API_ENABLED: 'false' });
    await request(server()).get('/api/health').expect(200);
    await request(server()).get('/api/ready').expect(200);
    await request(server()).get('/api/settings/all').expect(404);
  });
});
