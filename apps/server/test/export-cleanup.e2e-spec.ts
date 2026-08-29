import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync } from 'node:fs';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { EnImportDictionaryService } from '../src/modules/EnModule/modules/EnImportDictionary/enImportDictionary.service';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';

type PendingExportsT = Map<string, { filePath: string; timeout: NodeJS.Timeout }>;

/**
 * An export archive waits 15 minutes for its download (issue #315): the
 * wait must neither keep the process alive nor survive a stop as a leaked
 * temp file.
 */
describe('Export archives on shutdown (e2e, issue #315)', () => {
  let app: INestApplication<App>;
  const auth = { Authorization: '' };

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('unrefs the cleanup timer and removes the pending archive when the application closes', async () => {
    await request(app.getHttpServer()).get('/api/en/dictionary/export').set(auth).expect(200);

    const pending = (app.get(EnImportDictionaryService) as unknown as { pendingExports: PendingExportsT })
      .pendingExports;
    expect(pending.size).toBe(1);
    const [entry] = pending.values();
    expect(existsSync(entry.filePath)).toBe(true);
    expect(entry.timeout.hasRef()).toBe(false);

    await app.close();
    expect(pending.size).toBe(0);
    // unlink is fire-and-forget; give it a tick
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(existsSync(entry.filePath)).toBe(false);
  });
});
