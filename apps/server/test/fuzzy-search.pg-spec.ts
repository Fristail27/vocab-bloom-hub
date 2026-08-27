import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import {
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
  PublicSearchDetailedV1ResT,
  PublicSearchV1ResT,
} from '../types';

// Words with a typo-prone spelling; a loaded dictionary has them already,
// the empty database of CI gets them seeded
const WORDS = ['receive', 'relieve', 'retrieve', 'language'];
// unlike anything: no tier, not even the fuzzy one, has an answer
const NONSENSE = 'qzxvjwq';

/**
 * The trigram search (issue #278, Postgres only): the substring tiers keep
 * their behaviour, and when nothing matches the similarity tier answers
 * typos with `meta.fuzzy: true` and a `similarity` on every item.
 */
describe('trigram search (Postgres, issue #278)', () => {
  let app: INestApplication<App>;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  const search = (body: object) =>
    request(server())
      .post('/api/v1/search')
      .send(body)
      .expect(200)
      .then((res) => res.body as PublicSearchV1ResT);

  beforeAll(async () => {
    const username = process.env.ADMIN_USERNAME as string;
    const password = process.env.ADMIN_PASSWORD as string;
    const hashByEnv = await hashLoginString(username, password);
    const secretHash = await hashLoginString(username, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();

    for (const word of WORDS) {
      const existing = await request(server()).get(`/api/v1/words/${word}`);
      if (existing.status === 200) continue;
      await request(server())
        .post('/api/en/add/word')
        .set(auth)
        .send({
          word,
          part_of_speech: word === 'language' ? EnPartOfSpeechE.noun : EnPartOfSpeechE.verb,
          form_of_word: EnWordFormsE.base_form,
          area_variant: EnAreaVariantsE.common,
          meanings: [],
        })
        .expect(201);
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('answers a typo through the similarity tier, best match first, with the score on every item', async () => {
    const res = await search({ search: 'recieve' });
    expect(res.meta.fuzzy).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    const words = res.data.map((w) => w.word);
    expect(words).toEqual(expect.arrayContaining(['relieve']));
    const scores = res.data.map((w) => w.similarity as number);
    scores.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0.3);
      expect(s).toBeLessThanOrEqual(1);
    });
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);

    const detailed = await request(server())
      .post('/api/v1/search/detailed')
      .send({ search: 'lanquage' })
      .expect(200);
    const body = detailed.body as PublicSearchDetailedV1ResT;
    // a loaded dictionary has more than a page of similar headwords; an empty one does not
    expect(body.meta).toMatchObject({ page: 1, limit: 10, fuzzy: true });
    expect(body.data[0]).toMatchObject({ word: 'language', similarity: expect.any(Number) });
  });

  it('keeps the exact tiers first: a term that matches somewhere is never answered fuzzily', async () => {
    const exact = await search({ search: 'receive' });
    expect(exact.meta.fuzzy).toBe(false);
    expect(exact.data[0].word).toBe('receive');
    expect(exact.data[0]).not.toHaveProperty('similarity');

    // a substring hit ("language" contains "guag") comes from the contains tier
    const contains = await search({ search: 'guag' });
    expect(contains.meta.fuzzy).toBe(false);
    expect(contains.data.map((w) => w.word)).toEqual(expect.arrayContaining(['language']));
  });

  it('answers nothing, not fuzzily, when no headword is similar either', async () => {
    const res = await search({ search: NONSENSE });
    expect(res).toEqual({ data: [], meta: { count: 0, fuzzy: false } });
  });

  it('restricts the fuzzy tier to the requested entry type', async () => {
    const phrases = await search({ search: 'recieve', type: 'phrase' });
    expect(phrases.data.every((w) => w.part_of_speech === EnPartOfSpeechE.phrase)).toBe(true);
  });
});
