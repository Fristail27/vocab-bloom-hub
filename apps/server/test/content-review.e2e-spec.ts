import { EnMeaningTranslation } from '../src/modules/EnModule/entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../src/modules/EnModule/entities/en_short_translation.entity';
import { reviewContent } from '../core/utils/content_review';
import { AvailableTranslationLanguagesE, EnWordT } from '../types';
import { ReviewScopeE } from '../types/reviews';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/modules/AppModule/app.module';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { checkIsPostgres } from '../configuration';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../src/modules/EnModule/entities/en_meaning.entity';
import { EnChange } from '../src/modules/EnModule/entities/en_change.entity';
import { EnContentReview } from '../src/modules/EnModule/entities/en_content_review.entity';
import { EnPartOfSpeechE, EnWordFormsE, SuggestionKindE, SuggestionTargetE, ForkProgressT } from '../types';
import { ContentReviewT, ReviewStatusE } from '../types/reviews';

/** Runs on both SQLite and PostgreSQL in CI, against the existing disposable DB harness. */
describe('admin content review (#647)', () => {
  let app: INestApplication<App>, db: DataSource, word: EnWord, meaning: EnMeaning;
  const auth = { Authorization: '' };
  const api = () => request(app.getHttpServer());
  const state = async (dataset?: string) =>
    (
      await api()
        .get(`/api/en/reviews/word/${word.id}`)
        .query(dataset ? { dataset } : {})
        .set(auth)
        .expect(200)
    ).body as ContentReviewT[];
  const mark = async () =>
    api()
      .post(`/api/en/reviews/definition/${meaning.id}`)
      .set(auth)
      .send({ checked: true, expected: (await state())[0].expected })
      .expect(200);
  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const hash = await hashLoginString('e2e-admin', 'e2e-password');
    const secret = await hashLoginString('e2e-admin', hash);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secret + hash)}`;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    db = app.get(DataSource);
    word = await db.manager.save(EnWord, {
      word: await db.manager.save(EnEntry, { word: 'reviewbird' }),
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
      version: '1',
    });
    meaning = await db.manager.save(EnMeaning, {
      word,
      title: 'bird',
      definition: 'an animal with feathers',
      sort_order: 1,
    });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('requires authentication and validates scope, status, body and paging', async () => {
    await api().get(`/api/en/reviews/word/${word.id}`).expect(401);
    await api()
      .post(`/api/en/reviews/definition/${meaning.id}`)
      .send({ checked: true, expected: '' })
      .expect(401);
    await api().get('/api/en/reviews/words').set(auth).query({ scope: 'unknown' }).expect(400);
    await api()
      .get('/api/en/reviews/words')
      .set(auth)
      .query({ scope: 'definition', status: 'unknown' })
      .expect(400);
    await api().get('/api/en/reviews/words').set(auth).query({ scope: 'definition', limit: 101 }).expect(400);
    await api()
      .post(`/api/en/reviews/unknown/${meaning.id}`)
      .set(auth)
      .send({ checked: true, expected: '' })
      .expect(400);
    await api()
      .post(`/api/en/reviews/definition/${meaning.id}`)
      .set(auth)
      .send({ checked: true, expected: '', reviewer: 'someone' })
      .expect(400);
  });

  it('compares translated text and array variants with the exact values shown by the editor', async () => {
    const translation = await db.manager.save(EnMeaningTranslation, {
      meaning,
      language: AvailableTranslationLanguagesE.ru,
      title: 'птица',
      definition: 'животное',
      variants_of_words: ['a,b', '"bird"'],
    });
    const short = await db.manager.save(EnShortTranslation, {
      word,
      language: AvailableTranslationLanguagesE.ru,
      description: 'птица',
      variants_of_words: ['bird:1', 'bird:2'],
    });
    const shown = (await api().get(`/api/en/${word.id}`).set(auth).expect(200)).body as EnWordT;
    for (const [scope, id, expected] of [
      [
        ReviewScopeE.meaning_translation,
        translation.id,
        reviewContent(
          ReviewScopeE.meaning_translation,
          shown,
          shown.meanings[0].translations[0],
          shown.meanings[0],
        ),
      ],
      [
        ReviewScopeE.short_translation,
        short.id,
        reviewContent(ReviewScopeE.short_translation, shown, shown.short_translations[0]),
      ],
    ] as const) {
      await api()
        .post(`/api/en/reviews/${scope}/${id}`)
        .set(auth)
        .send({ checked: true, expected })
        .expect(200);
      expect((await state()).find((r) => r.scope === scope)?.status).toBe(ReviewStatusE.checked);
      await api()
        .post(`/api/en/reviews/${scope}/${id}`)
        .set(auth)
        .send({ checked: false, expected })
        .expect(200);
    }
    expect((await state()).every((r) => r.status === ReviewStatusE.unchecked)).toBe(true);
  });

  it('marks without public content changes, handles no-op saves, edits and real reverts', async () => {
    const before = await api().get('/api/v1/words/reviewbird').expect(200);
    await mark();
    expect((await state())[0].status).toBe(ReviewStatusE.checked);
    const after = await api().get('/api/v1/words/reviewbird').expect(200);
    expect(after.body).toEqual(before.body);
    expect(await db.manager.count(EnChange)).toBe(0);
    await api()
      .patch('/api/en/word/meaning')
      .set(auth)
      .send({ id: meaning.id, definition: meaning.definition })
      .expect(200);
    expect((await state())[0].status).toBe(ReviewStatusE.checked);
    await api()
      .patch('/api/en/word/meaning')
      .set(auth)
      .send({ id: meaning.id, definition: 'an edited definition' })
      .expect(200);
    expect((await state())[0].status).toBe(ReviewStatusE.changed);
    const change = (await db.manager.find(EnChange))[0];
    await api().post(`/api/en/changes/${change.id}/revert`).set(auth).expect(200);
    expect((await state())[0].status).toBe(ReviewStatusE.checked);
  });

  it('invalidates a review after an applied suggestion and rejects stale confirmation', async () => {
    const expected = (await state())[0].expected;
    const suggestion = await api()
      .post('/api/v1/suggestions')
      .send({
        headword: 'reviewbird',
        kind: SuggestionKindE.edit,
        edits: [
          {
            target_type: SuggestionTargetE.meaning,
            target_id: meaning.id,
            changes: { definition: 'a definition corrected by a reader' },
          },
        ],
      })
      .expect(201);
    await api().post(`/api/en/suggestions/${suggestion.body.data.id}/apply`).set(auth).expect(201);
    expect((await state())[0].status).toBe(ReviewStatusE.changed);
    await api()
      .post(`/api/en/reviews/definition/${meaning.id}`)
      .set(auth)
      .send({ checked: true, expected })
      .expect(409);
    const list = await api()
      .get('/api/en/reviews/words')
      .set(auth)
      .query({ scope: 'definition', status: 'changed' })
      .expect(200);
    expect(list.body).toMatchObject({ total: 1, counts: { changed: 1 }, items: [{ id: word.id, matches: 1 }] });
    await mark();
  });

  (checkIsPostgres() ? it : it.skip)(
    'does not transfer local reviews to a fork and isolates its subsequent marks',
    async () => {
      await api()
        .post('/api/en/datasets/default/fork')
        .set(auth)
        .send({
          name: 'review_fork',
          title: 'Review fork',
          license: { spdx: 'CC-BY-4.0' },
          attribution: 'Test',
        })
        .expect(202);
      let complete = false;
      for (let attempt = 0; attempt < 200; attempt++) {
        const result = (await api().get('/api/en/datasets/review_fork/fork-status').set(auth).expect(200))
          .body as ForkProgressT;
        if (result.state === 'failed') throw new Error(result.failure);
        if (result.state === 'completed') {
          complete = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(complete).toBe(true);
      const fork = (await state('review_fork'))[0];
      expect(fork.status).toBe(ReviewStatusE.unchecked);
      await api()
        .post(`/api/en/reviews/definition/${fork.id}`)
        .query({ dataset: 'review_fork' })
        .set(auth)
        .send({ checked: true, expected: fork.expected })
        .expect(200);
      await api()
        .post(`/api/en/reviews/definition/${meaning.id}`)
        .set(auth)
        .send({ checked: false, expected: '' })
        .expect(200);
      expect((await state())[0].status).toBe(ReviewStatusE.unchecked);
      expect((await state('review_fork'))[0].status).toBe(ReviewStatusE.checked);
      await api().delete('/api/en/datasets/review_fork').set(auth).expect(200);
    },
  );

  it('clears idempotently without adding a content-history entry', async () => {
    const changes = await db.manager.count(EnChange);
    for (let i = 0; i < 2; i++)
      await api()
        .post(`/api/en/reviews/definition/${meaning.id}`)
        .set(auth)
        .send({ checked: false, expected: '' })
        .expect(200);
    expect((await state())[0].status).toBe(ReviewStatusE.unchecked);
    expect(await db.manager.count(EnContentReview)).toBe(0);
    expect(await db.manager.count(EnChange)).toBe(changes);
  });
});
