import { DataSource } from 'typeorm';
import { EnMeaningTranslation } from '../src/modules/EnModule/entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../src/modules/EnModule/entities/en_short_translation.entity';
import { EnIssueRecordsT, EnIssuesStatisticsT } from '../types';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmRoot } from '../src/db/typeorm-root';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from '../configuration';
import request from 'supertest';
import { App } from 'supertest/types';

import { EnModule } from '../src/modules/EnModule/en.module';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import { AvailableTranslationLanguagesE, EnAreaVariantsE, EnPartOfSpeechE, EnWordFormsE } from '../types';

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
  short_translations: string[] = [],
) => ({
  word,
  part_of_speech,
  form_of_word: EnWordFormsE.base_form,
  generated: part_of_speech === EnPartOfSpeechE.verb,
  forms: [],
  meanings,
  short_translations: short_translations.map((description) => ({
    language: AvailableTranslationLanguagesE.ru,
    description,
    variants_of_words: [],
  })),
});

describe('actionable quality statistics (issue #648)', () => {
  let app: INestApplication<App>;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  const category = 'words_without_transcription';
  const summary = async (): Promise<EnIssuesStatisticsT> =>
    (await request(server()).get('/api/en/statistics/issues').set(auth).expect(200)).body;
  const records = async (query: Record<string, unknown>): Promise<EnIssueRecordsT> =>
    (await request(server()).get('/api/en/statistics/issues/records').set(auth).query(query).expect(200)).body;

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = E2E_USERNAME;
    process.env.ADMIN_PASSWORD = E2E_PASSWORD;
    const hash = await hashLoginString(E2E_USERNAME, E2E_PASSWORD);
    const secret = await hashLoginString(E2E_USERNAME, hash);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secret + hash)}`;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 1000 }] }),
        TypeOrmModule.forRootAsync(typeOrmRoot),
        EnModule,
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    for (const payload of [
      makeWord(
        'inspect',
        EnPartOfSpeechE.verb,
        [makeMeaning('first sense', true), makeMeaning('second sense', false)],
        ['перевод'],
      ),
      makeWord('inspect', EnPartOfSpeechE.noun),
      makeWord('unfilled', EnPartOfSpeechE.noun),
      makeWord('a phrase', EnPartOfSpeechE.phrase, [makeMeaning('phrase sense', false)]),
    ])
      await request(server()).post('/api/en/add/word').set(auth).send(payload).expect(201);
    await request(server())
      .post('/api/en/add/word')
      .set(auth)
      .send({
        ...makeWord('complete', EnPartOfSpeechE.noun, [], ['полный']),
        description: 'A fully populated control',
        transcription: 'complete',
        word_level: 'A1',
        meanings: [
          {
            ...makeMeaning('complete sense', true),
            examples: ['A complete example'],
            synonyms: ['inspect'],
            antonyms: ['unfilled'],
          },
        ],
      })
      .expect(201);
    // Legacy/imported translations can be blank even though normal forms reject them.
    const db = app.get(DataSource);
    const translations = db.getRepository(EnMeaningTranslation);
    const [translation] = await translations.find();
    await translations.update(translation.id, { title: ' ', definition: ' ' });
    const shorts = db.getRepository(EnShortTranslation);
    const [short] = await shorts.find();
    await shorts.update(short.id, { description: ' ' });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('requires authentication and validates categories, pages and limits', async () => {
    await request(server()).get('/api/en/statistics/issues/records').query({ category }).expect(401);
    for (const query of [
      {},
      { category: 'bad' },
      { category, page: 0 },
      { category, page: 1.5 },
      { category, limit: 101 },
      { category, limit: 0 },
      { category, extra: 'field' },
      { category: [category, category] },
    ]) {
      await request(server()).get('/api/en/statistics/issues/records').set(auth).query(query).expect(400);
    }
  });

  it('counts precisely the rows it lists for all eleven categories', async () => {
    const stats = await summary();
    expect(stats.issues).toHaveLength(11);
    expect(stats.issues.map((issue) => issue.count)).toEqual([2, 2, 3, 3, 3, 2, 3, 3, 3, 1, 1]);
    for (const issue of stats.issues) {
      const list = await records({ category: issue.key });
      expect(list).toMatchObject({ total: issue.count, kind: issue.kind, dataset: stats.dataset });
      expect(list.items).toHaveLength(issue.count);
      expect(new Set(list.items.map((item) => item.id)).size).toBe(issue.count);
    }
  });

  it('identifies the precise meaning/translation and parent word, including phrase meanings', async () => {
    const meanings = await records({ category: 'meanings_without_examples' });
    expect(meanings.items.map((item) => item.meaning_title)).toEqual([
      'first sense',
      'second sense',
      'phrase sense',
    ]);
    expect(meanings.items[0].word_id).toBe(meanings.items[1].word_id);
    expect(meanings.items[0].id).not.toBe(meanings.items[1].id);
    const translations = await records({ category: 'empty_meaning_translations' });
    expect(translations.items[0]).toMatchObject({
      word: 'inspect',
      part_of_speech: 'verb',
      language: 'ru',
      meaning_id: meanings.items[0].id,
      meaning_title: 'first sense',
    });
  });

  it('paginates stably and clamps the last page after a real correction', async () => {
    const first = await records({ category, limit: 2, page: 1 });
    const last = await records({ category, limit: 2, page: 2 });
    expect(first.items).toHaveLength(2);
    expect(last.items).toHaveLength(1);
    const id = last.items[0].word_id;
    await request(server())
      .patch(`/api/en/common-info/${id}`)
      .set(auth)
      .send({ transcription: 'filled' })
      .expect(200);
    const updated = await records({ category, limit: 2, page: 2 });
    expect(updated).toMatchObject({ total: 2, page: 1 });
    expect(updated.items.map((item) => item.word_id)).not.toContain(id);
    expect((await summary()).issues.find((issue) => issue.key === category)?.count).toBe(2);
    for (const item of updated.items) {
      await request(server())
        .patch(`/api/en/common-info/${item.word_id}`)
        .set(auth)
        .send({ transcription: 'filled' })
        .expect(200);
    }
    expect(await records({ category, page: 100 })).toMatchObject({ items: [], total: 0, page: 1 });
  });
});
