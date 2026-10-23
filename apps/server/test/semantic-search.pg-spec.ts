import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/modules/AppModule/app.module';
import { prepareDatabase, createDatasetSchema, searchPathExtra } from '../src/db/datasets';
import { DB_ENTITIES } from '../src/db/typeorm-options';
import { Dataset } from '../src/modules/DatasetsModule/entities/dataset.entity';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../src/modules/EnModule/entities/en_meaning.entity';
import { EnMeaningEmbedding } from '../src/modules/EnModule/entities/en_meaning_embedding.entity';
import { EnEmbeddingProfile } from '../src/modules/EnModule/entities/en_embedding_profile.entity';
import { EnChange } from '../src/modules/EnModule/entities/en_change.entity';
import { embeddingDocument, currentEmbeddingLines } from '../src/core/embeddings/transfer';
import { embeddingInputHash, embeddingProfileId } from '../src/core/embeddings/profile';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { EnPartOfSpeechE, EnWordFormsE, ChangeEntityE, ChangeActionE, ChangeOriginE } from '../types';

const pg = process.env.TEST_PGVECTOR === 'true' ? describe : describe.skip;
pg('separate semantic API with a local fixture model', () => {
  const previous = { ...process.env };
  const database = `vbh_semantic_${randomUUID().replaceAll('-', '')}`;
  const profile = {
    model: 'fixture:latest',
    revision: 'a'.repeat(64),
    dimensions: 3,
    normalization: 'l2' as const,
    document_format: 'meaning-v1',
    query_format: 'search-query-v1',
  };
  const profileId = embeddingProfileId(profile);
  let admin: DataSource;
  let ds: DataSource;
  let other: DataSource;
  let app: INestApplication<App>;
  let model: Server;
  let modelFailure = false;
  let modelMismatch = false;
  let servingRevision = profile.revision;
  const auth = { Authorization: '' };
  const calls: Array<{ path: string; body: string }> = [];
  let mainMeaning: EnMeaning;
  const api = () => request(app.getHttpServer());
  const endpoint = '/api/v1/search/semantic';

  async function seed(db: DataSource, spelling: string, embedding: number[]) {
    const word = await db.manager.save(EnWord, {
      word: await db.manager.save(EnEntry, { word: spelling }),
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
    });
    const meaning = await db.manager.save(EnMeaning, {
      word,
      sync_id: randomUUID(),
      sort_order: 1,
      title: 'Bird scientist — 鸟类',
      definition: 'A scientist who studies birds.',
    });
    await db.manager.save(EnMeaningEmbedding, {
      meaning_id: meaning.id,
      profile_id: profileId,
      dimensions: 3,
      input_hash: embeddingInputHash(embeddingDocument(meaning)),
      embedding,
    });
    return meaning;
  }
  beforeAll(async () => {
    Object.assign(process.env, {
      SEMANTIC_SEARCH_ENABLED: 'false',
      DICTIONARY_AUTO_IMPORT: 'false',
      UPDATE_CHECK: 'false',
      EMBEDDINGS_MODEL: profile.model,
      EMBEDDINGS_REVISION: profile.revision,
      EMBEDDINGS_DIMENSIONS: '3',
      PUBLIC_API_RATE_LIMIT: '1000/60',
      ADMIN_USERNAME: 'semantic-admin',
      ADMIN_PASSWORD: 'semantic-fixture-password',
    });
    const hash = await hashLoginString(process.env.ADMIN_USERNAME!, process.env.ADMIN_PASSWORD!);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, (await hashLoginString(process.env.ADMIN_USERNAME!, hash)) + hash)}`;
    admin = await new DataSource({ type: 'postgres', url: previous.DATABASE_URL }).initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    const url = new URL(previous.DATABASE_URL!);
    url.pathname = `/${database}`;
    process.env.DATABASE_URL = url.toString();
    await prepareDatabase();
    ds = await new DataSource({ type: 'postgres', url: url.toString(), entities: DB_ENTITIES }).initialize();
    await ds.query('CREATE SCHEMA vector_extension');
    await ds.query('CREATE EXTENSION vector WITH SCHEMA vector_extension');
    await ds.manager.insert(EnEmbeddingProfile, { ...profile, id: profileId });
    mainMeaning = await seed(ds, 'ornithologist', [1, 0, 0]);
    await seed(ds, 'birdwatcher', [0.8, 0.6, 0]);
    const stale = await seed(ds, 'stale', [1, 0, 0]);
    await ds.manager.update(EnMeaning, stale.id, { definition: 'Changed after embedding' });
    await createDatasetSchema('ds_semanticother');
    other = await new DataSource({
      type: 'postgres',
      url: url.toString(),
      entities: DB_ENTITIES,
      extra: searchPathExtra('ds_semanticother'),
    }).initialize();
    await ds.manager.save(Dataset, {
      name: 'semanticother',
      schema: 'ds_semanticother',
      source: 'semanticother',
      own: true,
      title: 'Other dictionary',
      license: 'CC0-1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution: 'Other author',
      is_public: true,
      language: 'en',
    });
    await other.manager.insert(EnEmbeddingProfile, { ...profile, id: profileId });
    await seed(other, 'otherword', [1, 0, 0]);
    model = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk.toString();
      calls.push({ path: req.url!, body });
      res.setHeader('Content-Type', 'application/json');
      if (modelFailure) {
        res.statusCode = 503;
        res.end('{}');
        return;
      }
      res.end(
        JSON.stringify(
          req.url === '/api/tags'
            ? { models: [{ name: profile.model, digest: modelMismatch ? 'b'.repeat(64) : servingRevision }] }
            : { model: profile.model, embeddings: [[1, 0, 0]] },
        ),
      );
    });
    await new Promise<void>((resolve) => model.listen(0, '127.0.0.1', resolve));
    process.env.EMBEDDINGS_URL = `http://127.0.0.1:${(model.address() as { port: number }).port}`;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (other?.isInitialized) await other.destroy();
    if (ds?.isInitialized) await ds.destroy();
    if (model) await new Promise<void>((resolve, reject) => model.close((e) => (e ? reject(e) : resolve())));
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.destroy();
    }
    for (const key of [
      'DATABASE_URL',
      'SEMANTIC_SEARCH_ENABLED',
      'DICTIONARY_AUTO_IMPORT',
      'UPDATE_CHECK',
      'EMBEDDINGS_MODEL',
      'EMBEDDINGS_REVISION',
      'EMBEDDINGS_DIMENSIONS',
      'EMBEDDINGS_URL',
      'PUBLIC_API_RATE_LIMIT',
      'ADMIN_USERNAME',
      'ADMIN_PASSWORD',
    ]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  beforeEach(() => {
    calls.length = 0;
    modelFailure = false;
    modelMismatch = false;
    servingRevision = profile.revision;
    process.env.SEMANTIC_SEARCH_ENABLED = 'true';
  });

  it('hides search while disabled and serves a no-inference, uncacheable capability', async () => {
    process.env.SEMANTIC_SEARCH_ENABLED = 'false';
    const status = await api().get(`${endpoint}/status`).expect(200);
    expect(status.body).toEqual({ data: { enabled: false } });
    expect(status.headers['cache-control']).toBe('no-store');
    await api().get(endpoint).query({ query: 'birds' }).expect(404);
    await api().get('/api/v1/search').query({ search: 'ornithologist' }).expect(200);
    expect(calls).toHaveLength(0);
  });
  it('returns matching senses with exact input filtering, public provenance and deterministic ranking', async () => {
    await ds.manager.save(EnChange, {
      headword: 'ornithologist',
      part_of_speech: EnPartOfSpeechE.noun,
      entity: ChangeEntityE.meaning,
      action: ChangeActionE.update,
      origin: ChangeOriginE.admin,
      record: {},
      diff: { definition: { before: 'old', after: mainMeaning.definition } },
      author: null,
      superseded_at: null,
    });
    const response = await api()
      .get(endpoint)
      .query({ query: 'учёный, изучающий птиц', limit: 20 })
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data.map((r: { word: { word: string } }) => r.word.word)).toEqual([
      'ornithologist',
      'birdwatcher',
    ]);
    const top = response.body.data[0];
    expect(top.meaning.id).toBe(mainMeaning.id);
    expect(top.meaning.modified).toBe(true);
    expect(top.word.source).toBe('vocab-bloom-hub');
    expect(top.meaning.source).toBe(top.word.source);
    expect(top.score).toBeCloseTo(1);
    expect(response.body.meta.dataset.attribution).toBeTruthy();
    expect(JSON.parse(calls.find((c) => c.path === '/api/embed')!.body).input).toBe(
      'task: search result | query: учёный, изучающий птиц',
    );
    expect(JSON.stringify(response.body)).not.toMatch(/embedding|generated_by_model|sync_id/);
  });
  it('isolates equal IDs in another public schema and rejects closed/unknown datasets before inference', async () => {
    const response = await api().get(endpoint).query({ query: 'birds', dataset: 'semanticother' }).expect(200);
    expect(response.body.data[0].word.word).toBe('otherword');
    expect(response.body.data[0].meaning.source).toBe('semanticother');
    expect(response.body.meta.dataset.dataset).toBe('semanticother');
    await ds.manager.update(Dataset, { name: 'semanticother' }, { is_public: false });
    calls.length = 0;
    await api().get(endpoint).query({ query: 'birds', dataset: 'semanticother' }).expect(404);
    await api().get(endpoint).query({ query: 'birds', dataset: 'missing' }).expect(404);
    expect(calls).toHaveLength(0);
    await ds.manager.update(Dataset, { name: 'semanticother' }, { is_public: true });
  });
  it('rejects invalid inputs before contacting the model', async () => {
    for (const query of [
      { query: ' ' },
      { query: 'x'.repeat(1001) },
      { query: 'birds', limit: 21 },
      { query: 'birds', limit: 0 },
      { query: 'birds', page: 2 },
      { query: 'birds', dataset: 'bad/name' },
    ])
      await api().get(endpoint).query(query).expect(400);
    expect(calls).toHaveLength(0);
  });
  it('fails explicitly for missing compatible vectors, incompatible models and offline inference', async () => {
    process.env.EMBEDDINGS_REVISION = 'c'.repeat(64);
    const absent = await api().get(endpoint).query({ query: 'birds' }).expect(503);
    expect(absent.body.message).toBe('semantic_vectors_unavailable');
    expect(calls).toHaveLength(0);
    process.env.EMBEDDINGS_REVISION = profile.revision;
    modelMismatch = true;
    const mismatch = await api().get(endpoint).query({ query: 'birds' }).expect(503);
    expect(mismatch.body.message).toBe('semantic_model_incompatible');
    modelMismatch = false;
    modelFailure = true;
    const failed = await api().get(endpoint).query({ query: 'birds' }).expect(503);
    expect(failed.body.message).toBe('semantic_model_unavailable');
    await api().get('/api/v1/search').query({ search: 'ornithologist' }).expect(200);
  });
  it('shares the existing public rate budget', async () => {
    process.env.PUBLIC_API_RATE_LIMIT = '1/60';
    await api()
      .get('/api/v1/search')
      .set('X-Forwarded-For', '198.51.100.42')
      .query({ search: 'bird' })
      .expect(200);
    await api().get(endpoint).set('X-Forwarded-For', '198.51.100.42').query({ query: 'birds' }).expect(429);
    expect(calls).toHaveLength(0);
    process.env.PUBLIC_API_RATE_LIMIT = '1000/60';
  });
  it('excludes edited and suggested inputs, restores exact reverts, and cascades deleted meanings', async () => {
    const meaning = await seed(ds, 'lifecycle', [1, 0, 0]);
    const current = async (expected: boolean) => {
      const response = await api().get(endpoint).query({ query: 'birds', limit: 20 }).expect(200);
      expect(response.body.data.some((row: { meaning: { id: number } }) => row.meaning.id === meaning.id)).toBe(
        expected,
      );
      const exported = [];
      for await (const line of currentEmbeddingLines(ds.manager, { ...profile, id: profileId }))
        exported.push(line);
      expect(exported.some((line) => line.meaning_sync_id === meaning.sync_id)).toBe(expected);
    };
    const revertLast = async () => {
      const change = await ds.manager.findOneOrFail(EnChange, {
        where: { headword: 'lifecycle' },
        order: { id: 'DESC' },
      });
      await api().post(`/api/en/changes/${change.id}/revert`).set(auth).expect(200);
    };
    await current(true);
    await api()
      .patch('/api/en/word/meaning')
      .set(auth)
      .send({ id: meaning.id, title: 'Changed title' })
      .expect(200);
    await current(false);
    await revertLast();
    await current(true);
    // These fields are not in the model input and must not invalidate a usable vector.
    await api()
      .patch('/api/en/word/meaning')
      .set(auth)
      .send({ id: meaning.id, examples: ['An example.'] })
      .expect(200);
    await current(true);
    const suggestion = await api()
      .post('/api/v1/suggestions')
      .send({
        headword: 'lifecycle',
        kind: 'edit',
        edits: [
          { target_type: 'meaning', target_id: meaning.id, changes: { definition: 'A revised definition.' } },
        ],
      })
      .expect(201);
    await api().post(`/api/en/suggestions/${suggestion.body.data.id}/apply`).set(auth).expect(201);
    await current(false);
    await revertLast();
    await current(true);
    // There is no admin rename/POS endpoint; exercise the stored inputs directly.
    await ds.manager.save(EnEntry, { word: 'renamed-lifecycle' });
    await ds.manager.update(EnWord, meaning.word.id, { word: { word: 'renamed-lifecycle' } });
    await current(false);
    await ds.manager.update(EnWord, meaning.word.id, { word: { word: 'lifecycle' } });
    await ds.manager.update(EnWord, meaning.word.id, { part_of_speech: EnPartOfSpeechE.verb });
    await current(false);
    await ds.manager.update(EnWord, meaning.word.id, { part_of_speech: EnPartOfSpeechE.noun });
    await current(true);
    await api().delete(`/api/en/word/meaning/${meaning.id}`).set(auth).expect(200);
    expect(await ds.manager.countBy(EnMeaningEmbedding, { meaning_id: meaning.id })).toBe(0);
    await revertLast();
    // Deletion discards derived data; restoring text never invents a missing vector.
    expect(await ds.manager.countBy(EnMeaningEmbedding, { meaning_id: meaning.id })).toBe(0);
    await current(false);
  });

  it('selects only the exact model generation even when another profile has the same dimensions', async () => {
    const next = { ...profile, revision: 'b'.repeat(64) };
    const id = embeddingProfileId(next);
    await ds.manager.insert(EnEmbeddingProfile, { ...next, id });
    const loaded = await ds.manager.findOneOrFail(EnMeaning, {
      where: { id: mainMeaning.id },
      relations: { word: { word: true } },
    });
    await ds.manager.insert(EnMeaningEmbedding, {
      profile_id: id,
      meaning_id: loaded.id,
      dimensions: 3,
      input_hash: embeddingInputHash(embeddingDocument(loaded)),
      embedding: [0, 1, 0],
    });
    try {
      process.env.EMBEDDINGS_REVISION = next.revision;
      servingRevision = next.revision;
      const response = await api().get(endpoint).query({ query: 'birds', limit: 20 }).expect(200);
      expect(response.body.meta.profile_id).toBe(id);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].score).toBeCloseTo(0);
      process.env.EMBEDDINGS_REVISION = 'c'.repeat(64);
      calls.length = 0;
      await api().get(endpoint).query({ query: 'birds' }).expect(503);
      expect(calls).toHaveLength(0);
    } finally {
      process.env.EMBEDDINGS_REVISION = profile.revision;
      servingRevision = profile.revision;
    }
  });
  it('keeps readiness and lexical search available without pgvector or a configured model', async () => {
    await ds.query('DROP EXTENSION vector');
    try {
      for (const enabled of ['false', 'true']) {
        process.env.SEMANTIC_SEARCH_ENABLED = enabled;
        await api().get('/api/ready').expect(200);
        await api().get('/api/v1/search').query({ search: 'ornithologist' }).expect(200);
        const response = await api()
          .get(endpoint)
          .query({ query: 'birds' })
          .expect(enabled === 'true' ? 503 : 404);
        expect(response.body.message).toBe(
          enabled === 'true' ? 'semantic_storage_unavailable' : 'semantic_search_disabled',
        );
      }
      process.env.EMBEDDINGS_REVISION = '';
      const unconfigured = await api().get(endpoint).query({ query: 'birds' }).expect(503);
      expect(unconfigured.body.message).toBe('semantic_search_unconfigured');
      expect(calls).toHaveLength(0);
    } finally {
      process.env.EMBEDDINGS_REVISION = profile.revision;
      await ds.query('CREATE EXTENSION vector WITH SCHEMA vector_extension');
    }
  });
});
