import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/auth/check-token (GET) responds with isValid=false without a token', () => {
    return request(app.getHttpServer()).get('/api/auth/check-token').expect(200).expect({ isValid: false });
  });

  it('protected routes respond with 401 without a token', () => {
    return request(app.getHttpServer()).get('/api/en/check-word/run').expect(401);
  });

  it('unknown routes respond with 404', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });
});
