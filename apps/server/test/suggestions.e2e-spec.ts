import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Repository } from 'typeorm';
import configuration from '../configuration';
import request from 'supertest';
import { App } from 'supertest/types';

import { EnModule } from '../src/modules/EnModule/en.module';
import { MAX_OPEN_SUGGESTIONS } from '../src/modules/SuggestionsModule/constants';
import { Suggestion } from '../src/modules/SuggestionsModule/entities/suggestion.entity';
import { AuditModule } from '../src/modules/AuditModule/audit.module';
import { AuditLog } from '../src/modules/AuditModule/entities/audit_log.entity';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../src/modules/EnModule/entities/en_meaning.entity';
import { EnMeaningTranslation } from '../src/modules/EnModule/entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../src/modules/EnModule/entities/en_short_translation.entity';
import { Settings } from '../src/modules/SettingsModule/entities/settings.entity';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import { EnPartOfSpeechE, EnWordFormsE, SuggestionKindE, SuggestionStatusE, SuggestionTargetE } from '../types';

const E2E_USERNAME = 'e2e-admin';
const E2E_PASSWORD = 'e2e-password';

describe('Suggestions: the public intake and the moderation queue (e2e, issue #327)', () => {
  let app: INestApplication<App>;
  let suggestionsRep: Repository<Suggestion>;
  let auditRep: Repository<AuditLog>;

  const server = () => app.getHttpServer();
  const auth = { Authorization: '' };

  const validBody = (extra: Record<string, unknown> = {}) => ({
    headword: 'run',
    message: 'The past simple is wrong: it should be "ran", not "runned".',
    ...extra,
  });

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = E2E_USERNAME;
    process.env.ADMIN_PASSWORD = E2E_PASSWORD;
    // the honest-use limit is a handful per hour; the suite needs more
    process.env.SUGGESTIONS_RATE_LIMIT = '1000/60';

    const hashByEnv = await hashLoginString(E2E_USERNAME, E2E_PASSWORD);
    const secretHash = await hashLoginString(E2E_USERNAME, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100_000 }] }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [
            EnEntry,
            EnWord,
            EnMeaning,
            EnMeaningTranslation,
            EnShortTranslation,
            Settings,
            AuditLog,
            Suggestion,
          ],
          synchronize: true,
          prepareDatabase: (db) => {
            db.pragma('foreign_keys = ON');
          },
        }),
        AuditModule,
        // brings SuggestionsModule, the moderation controller and the apply
        // service in the same arrangement the application boots with —
        // including the route order against GET /api/en/:id
        EnModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    suggestionsRep = app.get(getRepositoryToken(Suggestion));
    auditRep = app.get(getRepositoryToken(AuditLog));

    // the dictionary the reports point at, seeded straight through the repos
    const entries = app.get<Repository<EnEntry>>(getRepositoryToken(EnEntry));
    const words = app.get<Repository<EnWord>>(getRepositoryToken(EnWord));
    await entries.save({ word: 'run' });
    await words.save({
      word: { word: 'run' } as EnEntry,
      part_of_speech: EnPartOfSpeechE.verb,
      form_of_word: EnWordFormsE.base_form,
    });
  });

  afterAll(async () => {
    delete process.env.SUGGESTIONS_RATE_LIMIT;
    await app.close();
  });

  describe('POST /api/v1/suggestions (public)', () => {
    it('files a report without authentication and stores the canonical headword', async () => {
      const res = await request(server())
        .post('/api/v1/suggestions')
        .send(validBody({ headword: 'RUN' }))
        .expect(201);

      expect(res.body.data.id).toBeGreaterThan(0);
      expect(res.body.data.status).toBe(SuggestionStatusE.new);

      const stored = await suggestionsRep.findOneByOrFail({ id: res.body.data.id });
      expect(stored.headword).toBe('run');
      expect(stored.status).toBe(SuggestionStatusE.new);
    });

    it('accepts an entry reference and 404s an unknown one', async () => {
      const wordRow = await app
        .get<Repository<EnWord>>(getRepositoryToken(EnWord))
        .findOneByOrFail({ part_of_speech: EnPartOfSpeechE.verb });

      const res = await request(server())
        .post('/api/v1/suggestions')
        .send(validBody({ word_id: wordRow.id }))
        .expect(201);
      const stored = await suggestionsRep.findOne({
        where: { id: res.body.data.id },
        relations: { word: true },
      });
      expect(stored?.word?.id).toBe(wordRow.id);

      await request(server())
        .post('/api/v1/suggestions')
        .send(validBody({ word_id: 99_999 }))
        .expect(404);
    });

    it('404s a headword the dictionary does not have', async () => {
      await request(server())
        .post('/api/v1/suggestions')
        .send(validBody({ headword: 'no-such-word' }))
        .expect(404);
    });

    it('rejects a short message and unknown fields via the global pipe', async () => {
      await request(server())
        .post('/api/v1/suggestions')
        .send(validBody({ message: 'too short' }))
        .expect(400);
      await request(server())
        .post('/api/v1/suggestions')
        .send(validBody({ hacker: 'x' }))
        .expect(400);
    });

    it('answers 503 once too many reports wait for the admin', async () => {
      const open = await suggestionsRep.count({ where: { status: SuggestionStatusE.new } });
      const filler = Array.from({ length: MAX_OPEN_SUGGESTIONS - open }, (_, i) => ({
        headword: 'run',
        message: `queue filler ${i}`,
        status: SuggestionStatusE.new,
      }));
      await suggestionsRep.save(filler, { chunk: 500 });

      const res = await request(server()).post('/api/v1/suggestions').send(validBody()).expect(503);
      expect(res.body.message).toBe('suggestion_queue_full');

      await suggestionsRep
        .createQueryBuilder()
        .delete()
        .where('message LIKE :m', { m: 'queue filler %' })
        .execute();
    });
  });

  describe('the moderation queue (admin)', () => {
    it('rejects unauthenticated access', async () => {
      await request(server()).get('/api/en/suggestions').expect(401);
      await request(server()).patch('/api/en/suggestions/1').send({ status: 'resolved' }).expect(401);
      await request(server()).delete('/api/en/suggestions/1').expect(401);
    });

    it('lists newest first with filters and pagination', async () => {
      const res = await request(server()).get('/api/en/suggestions').set(auth).expect(200);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.items[0].headword).toBe('run');
      expect(res.body.items[0].created_at).toBeTruthy();

      const filtered = await request(server())
        .get('/api/en/suggestions')
        .set(auth)
        .query({ status: SuggestionStatusE.resolved })
        .expect(200);
      expect(filtered.body.total).toBe(0);

      const searched = await request(server())
        .get('/api/en/suggestions')
        .set(auth)
        .query({ search: 'ru', limit: 1 })
        .expect(200);
      expect(searched.body.items).toHaveLength(1);
      expect(searched.body.has_more).toBe(true);
    });

    it('resolves a report and records the verdict in the audit journal', async () => {
      const { body } = await request(server()).get('/api/en/suggestions').set(auth);
      const id = body.items[0].id as number;

      await request(server())
        .patch(`/api/en/suggestions/${id}`)
        .set(auth)
        .send({ status: SuggestionStatusE.resolved })
        .expect(200)
        .expect({ success: true });

      const stored = await suggestionsRep.findOneByOrFail({ id });
      expect(stored.status).toBe(SuggestionStatusE.resolved);

      const audit = await auditRep.findOneByOrFail({ entity_type: 'suggestion' as never, entity_id: id });
      expect(audit.diff).toEqual({ status: { before: 'new', after: 'resolved' } });
    });

    it('rejects a non-numeric id as 400 (issue #345)', async () => {
      await request(server())
        .patch('/api/en/suggestions/abc')
        .set(auth)
        .send({ status: SuggestionStatusE.resolved })
        .expect(400);
    });

    it('deletes a report and 404s what is gone', async () => {
      const { body } = await request(server()).get('/api/en/suggestions').set(auth);
      const id = body.items[0].id as number;

      await request(server()).delete(`/api/en/suggestions/${id}`).set(auth).expect(200);
      await request(server())
        .patch(`/api/en/suggestions/${id}`)
        .set(auth)
        .send({ status: SuggestionStatusE.dismissed })
        .expect(404);
    });
  });

  describe('the edit flow (issue #327): a structured change applied in one click', () => {
    let wordRowId: number;
    let editId: number;

    beforeAll(async () => {
      const words = app.get<Repository<EnWord>>(getRepositoryToken(EnWord));
      wordRowId = (await words.findOneByOrFail({ part_of_speech: EnPartOfSpeechE.verb })).id;
    });

    it('files a form edit with the current values snapshotted into the diffs', async () => {
      const res = await request(server())
        .post('/api/v1/suggestions')
        .send({
          headword: 'run',
          kind: SuggestionKindE.edit,
          edits: [
            {
              target_type: SuggestionTargetE.word,
              target_id: wordRowId,
              changes: { description: 'to move quickly on foot', transcription: '/rʌn/' },
            },
          ],
        })
        .expect(201);
      editId = res.body.data.id as number;

      const stored = await suggestionsRep.findOneByOrFail({ id: editId });
      expect(stored.kind).toBe(SuggestionKindE.edit);
      expect(stored.edits).toEqual([
        {
          target_type: SuggestionTargetE.word,
          target_id: wordRowId,
          changes: {
            description: { before: null, after: 'to move quickly on foot' },
            transcription: { before: null, after: '/rʌn/' },
          },
        },
      ]);
    });

    it('rejects unknown fields, empty diffs and a target of another headword', async () => {
      const edit = (targetId: number, changes: Record<string, unknown>) => ({
        headword: 'run',
        kind: SuggestionKindE.edit,
        edits: [{ target_type: SuggestionTargetE.word, target_id: targetId, changes }],
      });
      // a field outside the whitelist
      await request(server())
        .post('/api/v1/suggestions')
        .send(edit(wordRowId, { word_level: 'C2' }))
        .expect(400);
      // nothing changed
      await request(server()).post('/api/v1/suggestions').send(edit(wordRowId, {})).expect(400);
      // no edits at all
      await request(server())
        .post('/api/v1/suggestions')
        .send({ headword: 'run', kind: SuggestionKindE.edit, edits: [] })
        .expect(400);
      // the target does not belong to the named headword
      const entries = app.get<Repository<EnEntry>>(getRepositoryToken(EnEntry));
      const words = app.get<Repository<EnWord>>(getRepositoryToken(EnWord));
      await entries.save({ word: 'walk' });
      const other = await words.save({
        word: { word: 'walk' } as EnEntry,
        part_of_speech: EnPartOfSpeechE.verb,
        form_of_word: EnWordFormsE.base_form,
      });
      await request(server())
        .post('/api/v1/suggestions')
        .send(edit(other.id, { description: 'x'.repeat(12) }))
        .expect(404);
    });

    it('applies the edit in one click: the word changes, the entry is flagged, the report resolves', async () => {
      await request(server())
        .post(`/api/en/suggestions/${editId}/apply`)
        .set(auth)
        .expect(201)
        .expect({ success: true });

      const words = app.get<Repository<EnWord>>(getRepositoryToken(EnWord));
      const row = await words.findOneByOrFail({ id: wordRowId });
      expect(row.description).toBe('to move quickly on foot');

      // the edit went through the normal flow: the entry is the admin's now
      const entries = app.get<Repository<EnEntry>>(getRepositoryToken(EnEntry));
      expect((await entries.findOneByOrFail({ word: 'run' })).user_modified).toBe(true);

      const stored = await suggestionsRep.findOneByOrFail({ id: editId });
      expect(stored.status).toBe(SuggestionStatusE.resolved);

      // both the word edit and the verdict are in the journal
      expect(await auditRep.findOneBy({ entity_type: 'word' as never, entity_id: wordRowId })).toBeTruthy();
      expect(await auditRep.findOneBy({ entity_type: 'suggestion' as never, entity_id: editId })).toBeTruthy();
    });

    it('refuses to apply twice, or to apply a plain report', async () => {
      await request(server()).post(`/api/en/suggestions/${editId}/apply`).set(auth).expect(400);

      const report = await request(server()).post('/api/v1/suggestions').send(validBody()).expect(201);
      await request(server()).post(`/api/en/suggestions/${report.body.data.id}/apply`).set(auth).expect(400);
    });

    it('requires a message for a report but not for an edit', async () => {
      await request(server()).post('/api/v1/suggestions').send({ headword: 'run' }).expect(400);
    });
  });

  describe('rate limit', () => {
    it('throttles the intake once SUGGESTIONS_RATE_LIMIT is exhausted', async () => {
      // the limit is read per request: with the many requests this suite has
      // already made stored against the same client, a tiny budget trips now
      process.env.SUGGESTIONS_RATE_LIMIT = '1/3600';
      try {
        await request(server()).post('/api/v1/suggestions').send(validBody()).expect(429);
      } finally {
        process.env.SUGGESTIONS_RATE_LIMIT = '1000/60';
      }
    });
  });
});
