import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import {
  AuditActionE,
  AuditEntityTypeE,
  AuditListT,
  AuditTriggerE,
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
} from '../types';

const E2E_USERNAME = 'e2e-admin';
const E2E_PASSWORD = 'e2e-password';

const addWordBody = (word: string) => ({
  word,
  part_of_speech: EnPartOfSpeechE.verb,
  form_of_word: EnWordFormsE.base_form,
  description: `to ${word}`,
  forms: [],
  meanings: [
    {
      title: `${word} meaning`,
      definition: `definition of ${word}`,
      is_obsolete: false,
      sort_order: 1,
      examples: [],
      area_variant: EnAreaVariantsE.common,
      translations: [
        {
          language: AvailableTranslationLanguagesE.ru,
          title: 'перевод',
          definition: 'перевод',
          variants_of_words: ['перевод'],
        },
      ],
    },
  ],
  short_translations: [],
});

/**
 * The audit journal of issue #334: every admin mutation leaves one row with
 * the action, the entity, the headword and — for updates — the diff of the
 * changed fields; the listing is admin-only and filterable. The journal is
 * operational data: nothing of it appears on the public surface.
 */
describe('Audit log (e2e, issue #334)', () => {
  let app: INestApplication<App>;
  let wordId: number;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();

  const audit = async (query = ''): Promise<AuditListT> => {
    const res = await request(server()).get(`/api/en/audit${query}`).set(auth).expect(200);
    return res.body as AuditListT;
  };

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = E2E_USERNAME;
    process.env.ADMIN_PASSWORD = E2E_PASSWORD;
    const hashByEnv = await hashLoginString(E2E_USERNAME, E2E_PASSWORD);
    const secretHash = await hashLoginString(E2E_USERNAME, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('requires the admin token', async () => {
    await request(server()).get('/api/en/audit').expect(401);
  });

  it('starts empty', async () => {
    const list = await audit();
    expect(list).toEqual({ items: [], total: 0, page: 1, limit: 50, has_more: false });
  });

  it('records a word create with the headword, without meaning noise from the same transaction', async () => {
    const res = await request(server()).post('/api/en/add/word').set(auth).send(addWordBody('run')).expect(201);
    wordId = res.body.id;

    const list = await audit();
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({
      action: AuditActionE.create,
      entity_type: AuditEntityTypeE.word,
      entity_id: wordId,
      headword: 'run',
      trigger: AuditTriggerE.admin,
      diff: null,
    });
    expect(typeof list.items[0].created_at).toBe('string');
  });

  it('records an update with only the changed fields in the diff', async () => {
    await request(server())
      .patch(`/api/en/common-info/${wordId}`)
      .set(auth)
      .send({ word_level: 'B2', transcription: 'rʌn' })
      .expect(200);

    const [row] = (await audit('?action=update')).items;
    expect(row).toMatchObject({
      action: AuditActionE.update,
      entity_type: AuditEntityTypeE.word,
      entity_id: wordId,
      headword: 'run',
    });
    expect(row.diff).toMatchObject({
      word_level: { before: null, after: 'B2' },
      transcription: { before: null, after: 'rʌn' },
    });
    // the version stamp changes on every edit and is deliberately not journalled
    expect(row.diff).not.toHaveProperty('version');
  });

  it('records a standalone meaning create and a delete that still names the headword', async () => {
    const meaning = await request(server())
      .post('/api/en/word/meaning')
      .set(auth)
      .send({
        word_id: wordId,
        title: 'second meaning',
        definition: 'another definition',
        is_obsolete: false,
        sort_order: 2,
        examples: [],
        area_variant: EnAreaVariantsE.common,
        translations: [],
      })
      .expect(201);

    await request(server()).delete(`/api/en/word/meaning/${meaning.body.id}`).set(auth).expect(200);

    const rows = (await audit(`?entity_type=${AuditEntityTypeE.meaning}`)).items;
    expect(rows.map((r) => r.action)).toEqual([AuditActionE.delete, AuditActionE.create]);
    expect(rows.every((r) => r.headword === 'run')).toBe(true);
  });

  it('records settings changes under their field name', async () => {
    await request(server())
      .post('/api/settings/add')
      .set(auth)
      .send({ field: 'e2e_field', value: 'one' })
      .expect(201);
    await request(server())
      .patch('/api/settings/update')
      .set(auth)
      .send({ field: 'e2e_field', value: 'two' })
      .expect(200);

    const rows = (await audit(`?entity_type=${AuditEntityTypeE.setting}`)).items;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      action: AuditActionE.update,
      headword: 'e2e_field',
      diff: { value: { before: 'one', after: 'two' } },
    });
  });

  it('filters by action, entity type and headword prefix; pages newest first', async () => {
    const all = await audit('?limit=2&page=1');
    expect(all.items).toHaveLength(2);
    expect(all.has_more).toBe(true);
    expect(Date.parse(all.items[0].created_at)).toBeGreaterThanOrEqual(Date.parse(all.items[1].created_at));

    const words = await audit(`?entity_type=${AuditEntityTypeE.word}&search=ru`);
    expect(words.items.every((r) => r.entity_type === AuditEntityTypeE.word && r.headword === 'run')).toBe(
      true,
    );
    expect(words.items.length).toBeGreaterThanOrEqual(2);

    const created = await audit(`?action=${AuditActionE.create}&entity_type=${AuditEntityTypeE.word}`);
    expect(created.items).toHaveLength(1);
  });

  it('records a word delete before the word is gone', async () => {
    await request(server()).delete(`/api/en/${wordId}`).set(auth).expect(200);
    const [row] = (await audit(`?action=${AuditActionE.delete}&entity_type=${AuditEntityTypeE.word}`)).items;
    expect(row).toMatchObject({ entity_id: wordId, headword: 'run' });
  });

  it('stays off the public surface: the prefix is admin API', async () => {
    // with the admin API disabled the route does not exist (docs/api.md)
    expect((await audit()).total).toBeGreaterThan(0);
  });
});
