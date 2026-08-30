import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import { __resetOutOfContextForTests } from 'nestjs-pino/PinoLogger';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { createLoggerParams } from '../src/core/logging/logger';
import { PublicMetaService } from '../src/modules/PublicApiModule/public-meta.service';
import { captureLines } from './harness/log-capture';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Structured logging of issue #280: one JSON line per request with the request
 * id, method, path, status and duration; the id is echoed in X-Request-Id and
 * carried by every line written while the request is handled; probes are not
 * logged; credentials never are.
 */
describe('Structured logging (e2e, issue #280)', () => {
  let app: INestApplication<App>;
  let log: ReturnType<typeof captureLines>;
  const server = () => app.getHttpServer();

  const boot = async (customize?: (builder: ReturnType<typeof Test.createTestingModule>) => void) => {
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    __resetOutOfContextForTests();
    log = captureLines();
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(createLoggerParams({ format: 'json', level: 'info', stream: log.stream }));
    customize?.(builder);
    const moduleFixture: TestingModule = await builder.compile();
    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();
    log.lines.length = 0;
  };

  afterEach(async () => {
    await app?.close();
  });

  const requestLines = () => log.json().filter((line) => line.req !== undefined);

  it('writes one JSON line per request: id, method, url, status, duration — and echoes the id', async () => {
    await boot();
    const res = await request(server()).get('/api/v1/meta?x=1').expect(200);

    const id = res.headers['x-request-id'];
    expect(id).toMatch(UUID);
    const lines = requestLines();
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(line).toMatchObject({
      level: 'info',
      req: { id, method: 'GET', url: '/api/v1/meta?x=1' },
      res: { statusCode: 200 },
    });
    expect(typeof line.responseTime).toBe('number');
    expect(typeof line.time).toBe('string');
    expect(line.msg).toMatch(/^GET \/api\/v1\/meta\?x=1 200 \d+ms$/);
    // the request is described once; its headers are not part of it
    expect(line.req.headers).toBeUndefined();
  });

  it('reuses a well-formed X-Request-Id from the proxy or client, replaces anything else', async () => {
    await boot();
    const reused = await request(server()).get('/api/v1/meta').set('X-Request-Id', 'edge-7f3a.1').expect(200);
    expect(reused.headers['x-request-id']).toBe('edge-7f3a.1');
    expect(requestLines()[0].req.id).toBe('edge-7f3a.1');

    const replaced = await request(server())
      .get('/api/v1/meta')
      .set('X-Request-Id', 'not a valid id')
      .expect(200);
    expect(replaced.headers['x-request-id']).toMatch(UUID);
    expect(requestLines()[1].req.id).toBe(replaced.headers['x-request-id']);
  });

  it('does not log the probes', async () => {
    await boot();
    await request(server()).get('/api/health').expect(200);
    await request(server()).get('/api/ready').expect(200);
    await request(server()).get('/api/health?x=1').expect(200);
    expect(requestLines()).toHaveLength(0);
  });

  it('never logs the authorization header or the admin cookie', async () => {
    await boot();
    await request(server())
      .get('/api/en/words?page=1')
      .set('Authorization', 'Bearer secret-token-value')
      .set('Cookie', 'bearer=secret-cookie-value')
      .expect(401);

    const everything = log.lines.join('\n');
    expect(everything).not.toContain('secret-token-value');
    expect(everything).not.toContain('secret-cookie-value');
    // the 401 is a client's mistake: the request line stays at info, the filter warns once
    expect(requestLines()[0]).toMatchObject({ level: 'info', res: { statusCode: 401 } });
    expect(log.json().filter((line) => line.level === 'warn')).toHaveLength(1);
  });

  it("logs the server's own failure at error, with the stack, under the request id", async () => {
    await boot((builder) =>
      builder.overrideProvider(PublicMetaService).useValue({
        getMeta: () => {
          throw new Error('meta exploded');
        },
      }),
    );
    const res = await request(server()).get('/api/v1/meta').expect(500);
    const id = res.headers['x-request-id'];

    const errors = log.json().filter((line) => line.level === 'error');
    expect(errors).toHaveLength(2);
    const filterLine = errors.find((line) => line.context === 'AllExceptionsFilter');
    expect(filterLine).toMatchObject({
      reqId: id,
      statusCode: 500,
      msg: 'Unhandled exception on GET /api/v1/meta',
    });
    expect(filterLine?.err.stack).toContain('Error: meta exploded');
    const requestLine = errors.find((line) => line.req !== undefined);
    expect(requestLine).toMatchObject({ req: { id }, res: { statusCode: 500 } });
    expect(requestLine?.msg).toMatch(/^GET \/api\/v1\/meta 500 \d+ms$/);
  });
});
