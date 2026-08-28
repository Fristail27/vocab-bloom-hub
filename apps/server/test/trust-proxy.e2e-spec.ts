import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { getTrustProxy } from '../src/core/utils/http-hardening';

// Real-looking client addresses (TEST-NET-3), all arriving from the same
// local socket as a reverse proxy would deliver them
const CLIENT_A = '203.0.113.10';
const CLIENT_B = '203.0.113.20';

/**
 * TRUST_PROXY (issue #283): the public rate limit keys its counters by the
 * client address. Without trust proxy every request behind a proxy shares
 * the proxy's address and one budget; with it the address comes from
 * X-Forwarded-For and each client gets its own. The throttler's headers make
 * the bucket visible: X-RateLimit-Remaining drops per bucket.
 */
describe('TRUST_PROXY and the client address (e2e, issue #283)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();
  const savedTrustProxy = process.env.TRUST_PROXY;

  const boot = async (trustProxy: string | undefined) => {
    if (trustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = trustProxy;
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    // the same wiring as main.ts
    app.getHttpAdapter().getInstance().set('trust proxy', getTrustProxy());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();
  };

  const remainingFor = async (forwardedFor: string): Promise<number> => {
    const res = await request(server()).get('/api/v1/meta').set('X-Forwarded-For', forwardedFor).expect(200);
    return Number(res.headers['x-ratelimit-remaining']);
  };

  afterEach(async () => {
    await app?.close();
  });

  afterAll(() => {
    if (savedTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = savedTrustProxy;
  });

  it('shares one rate-limit budget between forwarded clients when TRUST_PROXY is unset', async () => {
    await boot(undefined);
    const first = await remainingFor(CLIENT_A);
    const second = await remainingFor(CLIENT_B);
    // the header is ignored: both count against the socket address
    expect(second).toBe(first - 1);
  });

  it('gives every forwarded client its own budget with TRUST_PROXY=1', async () => {
    await boot('1');
    const first = await remainingFor(CLIENT_A);
    const other = await remainingFor(CLIENT_B);
    const again = await remainingFor(CLIENT_A);
    expect(other).toBe(first);
    expect(again).toBe(first - 1);
  });
});
