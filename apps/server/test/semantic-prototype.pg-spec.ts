import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir, cpus, platform, arch } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/modules/AppModule/app.module';
import { prepareDatabase } from '../src/db/datasets';
import { DB_ENTITIES } from '../src/db/typeorm-options';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../src/modules/EnModule/entities/en_meaning.entity';
import { EnMeaningEmbedding } from '../src/modules/EnModule/entities/en_meaning_embedding.entity';
import { embeddingDocument } from '../src/core/embeddings/transfer';
import { embeddingInputHash, embeddingProfileId, embeddingVector } from '../src/core/embeddings/profile';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { EnPartOfSpeechE, EnWordFormsE, type PublicSemanticSearchV1ResT } from '../types';

type Meaning = {
  id: string;
  source_word_id: number;
  word: string;
  part_of_speech: EnPartOfSpeechE;
  title: string;
  definition: string;
  input: string;
  input_sha256: string;
};
type Query = {
  id: string;
  query: string;
  input: string;
  language: string;
  category: string;
  split: string;
  expected_meaning_ids: string[];
  top10: Array<{ id: string; score: number }>;
};
const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, 'utf8')) as T;
const jsonl = async <T>(file: string): Promise<T[]> =>
  (await readFile(file, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as T);
const distribution = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1];
  return { count: sorted.length, p50: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1) };
};

// Explicit opt-in: private prototype content and vectors are never committed or downloaded.
// Always creates/drops a NEW database, even when DATABASE_URL names an existing database.
const prototype =
  process.env.SEMANTIC_PROTOTYPE_DIR && process.env.TEST_PGVECTOR === 'true' ? describe : describe.skip;
prototype('saved prototype through the real import, semantic API and export', () => {
  const previous = { ...process.env };
  const database = `vbh_prototype_${randomUUID().replaceAll('-', '')}`;
  const auth = { Authorization: '' };
  let admin: DataSource;
  let ds: DataSource;
  let app: INestApplication<App>;
  let model: Server;
  let cache: DatabaseSync;
  let dir: string;
  const api = () => request(app.getHttpServer());

  afterAll(async () => {
    await app?.close();
    if (model?.listening) await new Promise<void>((done) => model.close(() => done()));
    cache?.close();
    if (ds?.isInitialized) await ds.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.destroy();
    }
    if (dir) await rm(dir, { recursive: true, force: true });
    for (const key of new Set([...Object.keys(previous), ...Object.keys(process.env)])) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it('reproduces saved rankings and remaps portable vectors with inference disabled during transfer', async () => {
    const source = resolve(process.env.SEMANTIC_PROTOTYPE_DIR!);
    const complete = await json<{
      meanings: number;
      queries: number;
      dimensions: number;
      model_digest: string;
    }>(join(source, 'COMPLETE.json'));
    const modelInfo = await json<{ name: string; digest: string }>(join(source, 'model.json'));
    const meanings = await jsonl<Meaning>(join(source, 'meanings.jsonl'));
    const queries = await jsonl<Query>(join(source, 'rankings.jsonl'));
    expect(meanings).toHaveLength(complete.meanings);
    expect(queries).toHaveLength(complete.queries);
    expect(modelInfo.digest).toBe(complete.model_digest);
    const profile = {
      model: modelInfo.name,
      revision: modelInfo.digest,
      dimensions: complete.dimensions,
      normalization: 'l2' as const,
      document_format: 'meaning-v1',
      query_format: 'search-query-v1',
    };
    const profileId = embeddingProfileId(profile);
    cache = new DatabaseSync(join(source, 'cache.sqlite'), { readOnly: true });
    const cachedVector = (kind: string, id: string, input: string) => {
      const row = cache.prepare('SELECT * FROM embeddings WHERE kind = ? AND id = ?').get(kind, id)!;
      expect(row.input_sha256).toBe(embeddingInputHash(input));
      expect(row.model_digest).toBe(profile.revision);
      expect(row.dimensions).toBe(profile.dimensions);
      const bytes = Buffer.from(row.vector as Uint8Array);
      expect(bytes.length).toBe(profile.dimensions * 4);
      return embeddingVector(
        Array.from({ length: profile.dimensions }, (_, i) => bytes.readFloatLE(i * 4)),
        profile.dimensions,
      );
    };
    Object.assign(process.env, {
      SEMANTIC_SEARCH_ENABLED: 'false',
      DICTIONARY_AUTO_IMPORT: 'false',
      UPDATE_CHECK: 'false',
      EMBEDDINGS_MODEL: profile.model,
      EMBEDDINGS_REVISION: profile.revision,
      EMBEDDINGS_DIMENSIONS: String(profile.dimensions),
      PUBLIC_API_RATE_LIMIT: '10000/60',
      ADMIN_USERNAME: 'prototype-admin',
      ADMIN_PASSWORD: 'prototype-fixture-password',
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
    await ds.query('CREATE EXTENSION vector');
    dir = await mkdtemp(join(tmpdir(), 'vbh-prototype-'));
    const words = new Map<number, EnWord>();
    for (const item of meanings) {
      if (!words.has(item.source_word_id))
        words.set(item.source_word_id, {
          id: words.size + 1,
          sync_id: randomUUID(),
          word: { word: item.word } as EnEntry,
          part_of_speech: item.part_of_speech,
          form_of_word: EnWordFormsE.base_form,
          generated: false,
        } as EnWord);
    }
    const entries = [...new Set(meanings.map((m) => m.word))].map((word) => ({ word }));
    const rows = meanings.map(
      (item, i) =>
        ({
          id: i + 10001,
          sync_id: randomUUID(),
          word: words.get(item.source_word_id)!,
          title: item.title,
          definition: item.definition,
          sort_order: i + 1,
        }) as EnMeaning,
    );
    // New fixture identities only; old source IDs are never treated as portable IDs.
    for (let offset = 0; offset < entries.length; offset += 200)
      await ds.manager.insert(EnEntry, entries.slice(offset, offset + 200));
    for (let offset = 0; offset < words.size; offset += 200)
      await ds.manager.insert(EnWord, [...words.values()].slice(offset, offset + 200));
    for (let offset = 0; offset < rows.length; offset += 200)
      await ds.manager.insert(EnMeaning, rows.slice(offset, offset + 200));
    const file = join(dir, 'meaning-embeddings.jsonl');
    const lines = meanings.map((item, i) => {
      expect(embeddingDocument(rows[i])).toBe(item.input);
      expect(embeddingInputHash(item.input)).toBe(item.input_sha256);
      return JSON.stringify({
        meaning_sync_id: rows[i].sync_id,
        profile_id: profileId,
        input_hash: item.input_sha256,
        embedding: cachedVector('meaning', item.id, item.input),
      });
    });
    await writeFile(file, lines.join('\n') + '\n');
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    const manifest = {
      version: '',
      source: 'vocab-bloom-hub',
      files: { 'meaning-embeddings.jsonl': { lines: rows.length } },
      embeddings: { format: 1, profiles: [{ ...profile, id: profileId }] },
    };
    // No HTTP model exists yet. Transfer must work while semantic search is off.
    const importStarted = performance.now();
    const imported = await api()
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', 'default')
      .attach('embeddings', file)
      .attach('manifest', Buffer.from(JSON.stringify(manifest)), 'manifest.json')
      .expect(201);
    expect(imported.text).not.toContain('"error"');
    expect(await ds.manager.count(EnMeaningEmbedding)).toBe(rows.length);
    const importMs = performance.now() - importStarted;
    await ds.query('ANALYZE');
    const vectors = new Map(queries.map((q) => [q.input, cachedVector('query', q.id, q.input)]));
    let inferenceCalls = 0;
    model = createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/tags') {
        res.end(JSON.stringify({ models: [{ name: profile.model, digest: profile.revision }] }));
        return;
      }
      let body = '';
      for await (const chunk of req) body += chunk.toString();
      const input = (JSON.parse(body) as { input: string }).input;
      const vector = vectors.get(input);
      inferenceCalls++;
      res.statusCode = vector ? 200 : 400;
      res.end(JSON.stringify({ model: profile.model, embeddings: vector ? [vector] : [] }));
    });
    await new Promise<void>((done) => model.listen(0, '127.0.0.1', done));
    process.env.EMBEDDINGS_URL = `http://127.0.0.1:${(model.address() as { port: number }).port}`;
    process.env.SEMANTIC_SEARCH_ENABLED = 'true';
    const search = async (query: Query) => {
      const response = await api()
        .get('/api/v1/search/semantic')
        .query({ query: query.query, limit: 10 })
        .expect(200);
      return response.body as PublicSemanticSearchV1ResT;
    };
    for (const query of queries.slice(0, 5)) await search(query);
    const sourceIds = new Map(rows.map((row, i) => [row.id, meanings[i].id]));
    const measurements = [];
    for (const query of queries) {
      const started = performance.now();
      const response = await search(query);
      const ms = performance.now() - started;
      const ids = response.data.map((hit) => sourceIds.get(hit.meaning.id));
      expect(ids).toEqual(query.top10.map((hit) => hit.id));
      for (let i = 0; i < response.data.length; i++)
        expect(response.data[i].score).toBeCloseTo(query.top10[i].score, 5);
      const rank = ids.findIndex((id) => query.expected_meaning_ids.includes(id!)) + 1;
      measurements.push({
        id: query.id,
        language: query.language,
        category: query.category,
        split: query.split,
        positive: query.expected_meaning_ids.length > 0,
        seed_rank: rank || null,
        top_score: response.data[0].score,
        ms,
      });
    }
    expect(inferenceCalls).toBe(queries.length + 5);
    const [initialSizes] =
      await ds.query(`SELECT pg_total_relation_size('en_meaning_embeddings')::float8 AS vector_table_bytes,
      pg_database_size(current_database())::float8 AS fixture_database_bytes`);
    process.env.SEMANTIC_SEARCH_ENABLED = 'false';
    await new Promise<void>((done) => model.close(() => done()));
    const exportStarted = performance.now();
    const exported = await api()
      .get('/api/en/dictionary/export')
      .query({ embeddings_only: true })
      .set(auth)
      .expect(200);
    expect(exported.text).not.toContain('"error"');
    const { exportId } = JSON.parse(exported.text.trim().split('\n').at(-1)!) as { exportId: string };
    const archive = await api()
      .get(`/api/en/dictionary/export/download/${exportId}`)
      .set(auth)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const exportMs = performance.now() - exportStarted;
    const fingerprint = () =>
      ds.query(`SELECT md5(string_agg(v.profile_id || m.sync_id || v.input_hash || v.embedding::text, '' ORDER BY m.sync_id)) AS hash
      FROM en_meaning_embeddings v JOIN en_meanings m ON m.id = v.meaning_id`);
    const before = await fingerprint();
    await ds.query('DELETE FROM en_meanings');
    for (const row of rows) row.id += 10000;
    for (let offset = 0; offset < rows.length; offset += 200)
      await ds.manager.insert(EnMeaning, rows.slice(offset, offset + 200));
    const reimportStarted = performance.now();
    const restored = await api()
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', 'default')
      .attach('archive', archive.body as Buffer, 'vectors.zip')
      .expect(201);
    expect(restored.text).not.toContain('"error"');
    expect(await ds.manager.count(EnMeaningEmbedding)).toBe(rows.length);
    expect(await fingerprint()).toEqual(before);
    const reimportMs = performance.now() - reimportStarted;
    const [afterRoundtripSizes] =
      await ds.query(`SELECT pg_total_relation_size('en_meaning_embeddings')::float8 AS vector_table_bytes,
      pg_database_size(current_database())::float8 AS fixture_database_bytes`);
    const report = {
      measured_at: new Date().toISOString(),
      node: process.version,
      host: `${platform()} ${arch()} ${cpus()[0]?.model}`,
      postgres: (await ds.query('SELECT version() AS version'))[0].version,
      pgvector: (await ds.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'"))[0].extversion,
      meanings: rows.length,
      dimensions: profile.dimensions,
      profile_id: profileId,
      methodology:
        'Five warmups, then one sequential pass of saved queries through Supertest/Nest + PostgreSQL. Local HTTP fixture returns cached query vectors; actual inference and LAN latency EXCLUDED. Exact scan, no ANN index. Prototype seed labels are not independent judgments.',
      import_ms: importMs,
      export_ms: exportMs,
      reimport_ms: reimportMs,
      vector_payload_bytes: rows.length * profile.dimensions * 4,
      initial_sizes: initialSizes,
      after_roundtrip_sizes: afterRoundtripSizes,
      query_ms: distribution(measurements.map((m) => m.ms)),
      measurements,
      ranking_matches: measurements.length,
      roundtrip:
        'Identical profile, portable ID, hash and float32 payload after changing every numeric meaning ID; model offline and flag disabled.',
    };
    await writeFile(join(source, 'step7-api-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ...report, measurements: undefined }, null, 2));
  }, 300_000);
});
