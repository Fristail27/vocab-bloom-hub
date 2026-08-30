import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuditLog } from '../src/modules/AuditModule/entities/audit_log.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from '../configuration';
import request from 'supertest';
import { App } from 'supertest/types';

import { EnModule } from '../src/modules/EnModule/en.module';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../src/modules/EnModule/entities/en_meaning.entity';
import { EnMeaningTranslation } from '../src/modules/EnModule/entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../src/modules/EnModule/entities/en_short_translation.entity';
import { Settings } from '../src/modules/SettingsModule/entities/settings.entity';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnMeaningsListT,
  EnMeaningTranslationsListT,
  EnPartOfSpeechE,
  EnWordFormsE,
  EnWordsListT,
} from '../types';

const E2E_USERNAME = 'e2e-admin';
const E2E_PASSWORD = 'e2e-password';

const makeMeaning = (title: string, translated: boolean) => ({
  title,
  definition: `definition of ${title}`,
  is_obsolete: false,
  sort_order: 0,
  examples: [],
  area_variant: EnAreaVariantsE.common,
  translations: translated
    ? [
        {
          language: AvailableTranslationLanguagesE.ru,
          title: `${title}-ru`,
          definition: 'ru',
          variants_of_words: [],
        },
      ]
    : [],
});

const makeWord = (
  word: string,
  part_of_speech: EnPartOfSpeechE,
  meanings: ReturnType<typeof makeMeaning>[] = [],
) => ({
  word,
  part_of_speech,
  form_of_word: EnWordFormsE.base_form,
  generated: part_of_speech === EnPartOfSpeechE.verb,
  forms: [],
  meanings,
  short_translations: [],
});

describe('admin listings GET /api/en/words, /meanings, /meaning-translations (e2e, issue #249)', () => {
  let app: INestApplication<App>;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = E2E_USERNAME;
    process.env.ADMIN_PASSWORD = E2E_PASSWORD;
    const hashByEnv = await hashLoginString(E2E_USERNAME, E2E_PASSWORD);
    const secretHash = await hashLoginString(E2E_USERNAME, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation, Settings, AuditLog],
          synchronize: true,
          prepareDatabase: (db) => {
            db.pragma('foreign_keys = ON');
          },
        }),
        EnModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    await request(server())
      .post('/api/en/add/word')
      .set(auth)
      .send(
        makeWord('run', EnPartOfSpeechE.verb, [makeMeaning('move fast', true), makeMeaning('manage', false)]),
      )
      .expect(201);
    await request(server())
      .post('/api/en/add/word')
      .set(auth)
      .send(makeWord('run', EnPartOfSpeechE.noun))
      .expect(201);
    await request(server())
      .post('/api/en/add/word')
      .set(auth)
      .send(makeWord('abandon', EnPartOfSpeechE.verb))
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is admin-only', async () => {
    await request(server()).get('/api/en/words').expect(401);
  });

  // EnController serves GET /api/en/:id; the listing controller must win the route match
  it('is served by the listing controller, not by GET /api/en/:id', async () => {
    const res = await request(server()).get('/api/en/words').set(auth).expect(200);
    const body = res.body as EnWordsListT;

    expect(body.items.map((i) => `${i.word}:${i.part_of_speech}`)).toEqual([
      'abandon:verb',
      'run:noun',
      'run:verb',
    ]);
    expect(body).toMatchObject({ page: 1, limit: 50, total: 3, has_more: false });
  });

  it('parses repeated enum keys, boolean strings and pagination from the query string', async () => {
    const res = await request(server())
      .get('/api/en/words')
      .set(auth)
      .query('part_of_speech=verb&part_of_speech=noun&generated=true&search=ru&page=1&limit=1')
      .expect(200);
    const body = res.body as EnWordsListT;

    expect(body.items.map((i) => `${i.word}:${i.part_of_speech}`)).toEqual(['run:verb']);
    expect(body).toMatchObject({ page: 1, limit: 1, total: 1, has_more: false });
  });

  it('rejects unknown query keys and invalid values', async () => {
    await request(server()).get('/api/en/words').set(auth).query({ sort: 'word' }).expect(400);
    await request(server()).get('/api/en/words').set(auth).query({ generated: 'maybe' }).expect(400);
    await request(server()).get('/api/en/words').set(auth).query({ limit: 500 }).expect(400);
  });

  it('lists meanings with their word, admin-only and not swallowed by GET /api/en/:id', async () => {
    await request(server()).get('/api/en/meanings').expect(401);

    const res = await request(server())
      .get('/api/en/meanings')
      .set(auth)
      .query('part_of_speech=verb&has_translations=true')
      .expect(200);
    const body = res.body as EnMeaningsListT;

    expect(body.items.map((i) => `${i.word}:${i.part_of_speech}:${i.title}`)).toEqual(['run:verb:move fast']);
    expect(body.items[0]).toMatchObject({ definition: 'definition of move fast', translations_count: 1 });
    expect(body).toMatchObject({ page: 1, limit: 50, total: 1, has_more: false });

    await request(server()).get('/api/en/meanings').set(auth).query({ generated: 'true' }).expect(400);
  });

  it('lists meaning translations with their meaning and word, admin-only and not swallowed by GET /api/en/:id', async () => {
    await request(server()).get('/api/en/meaning-translations').expect(401);

    const res = await request(server())
      .get('/api/en/meaning-translations')
      .set(auth)
      .query('language=ru&search=ru')
      .expect(200);
    const body = res.body as EnMeaningTranslationsListT;

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      word: 'run',
      part_of_speech: 'verb',
      meaning_title: 'move fast',
      language: 'ru',
      title: 'move fast-ru',
    });
    expect(body).toMatchObject({ total: 1, has_more: false });

    await request(server()).get('/api/en/meaning-translations').set(auth).query({ language: 'xx' }).expect(400);
  });
});
