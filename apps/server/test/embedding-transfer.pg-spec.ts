import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { prepareDatabase, createDatasetSchema, searchPathExtra } from '../src/db/datasets';
import { DB_ENTITIES } from '../src/db/typeorm-options';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../src/modules/EnModule/entities/en_meaning.entity';
import { EnMeaningEmbedding } from '../src/modules/EnModule/entities/en_meaning_embedding.entity';
import { embeddingDocument, importMeaningEmbeddings } from '../src/core/embeddings/transfer';
import { embeddingInputHash, embeddingProfileId } from '../src/core/embeddings/profile';
import { EnPartOfSpeechE, EnWordFormsE } from '../types';

/** All DDL and data stay in a newly created disposable database. */
describe('embedding file publication on PostgreSQL', () => {
  const configured = process.env.DATABASE_URL!;
  const database = `vbh_transfer_${randomUUID().replaceAll('-', '')}`;
  let admin: DataSource;
  let source: DataSource;
  let target: DataSource;
  let dir: string;
  beforeAll(async () => {
    admin = await new DataSource({ type: 'postgres', url: configured }).initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    const url = new URL(configured);
    url.pathname = `/${database}`;
    process.env.DATABASE_URL = url.toString();
    await prepareDatabase();
    source = await new DataSource({
      type: 'postgres',
      url: url.toString(),
      entities: DB_ENTITIES,
    }).initialize();
    await createDatasetSchema('ds_transfer');
    target = await new DataSource({
      type: 'postgres',
      url: url.toString(),
      entities: DB_ENTITIES,
      extra: searchPathExtra('ds_transfer'),
    }).initialize();
    process.env.DATABASE_URL = configured;
    dir = await mkdtemp(join(tmpdir(), 'vbh-transfer-pg-'));
  });
  afterAll(async () => {
    process.env.DATABASE_URL = configured;
    if (target?.isInitialized) await target.destroy();
    if (source?.isInitialized) await source.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.destroy();
    }
    if (dir) await rm(dir, { recursive: true, force: true });
  });
  it('uses the receiving schema, serializes writers, and rolls back a damaged replacement', async () => {
    const word = await target.manager.save(EnWord, {
      word: await target.manager.save(EnEntry, { word: 'bird' }),
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
    });
    const meaning = await target.manager.save(EnMeaning, {
      word,
      sync_id: randomUUID(),
      sort_order: 1,
      title: 'bird',
      definition: 'A feathered animal.',
    });
    const profile = {
      model: 'fixture',
      revision: 'a'.repeat(64),
      dimensions: 3,
      normalization: 'l2' as const,
      document_format: 'meaning-v1',
      query_format: 'search-query-v1',
    };
    const manifest = { format: 1 as const, profiles: [{ ...profile, id: embeddingProfileId(profile) }] };
    const line = {
      meaning_sync_id: meaning.sync_id,
      profile_id: manifest.profiles[0].id,
      input_hash: embeddingInputHash(embeddingDocument(meaning)),
      embedding: [1, 0, 0],
    };
    const file = join(dir, 'vectors.jsonl');
    await writeFile(file, JSON.stringify(line) + '\n');
    await importMeaningEmbeddings(target.manager, file, manifest, 1);
    expect(await target.manager.count(EnMeaningEmbedding)).toBe(1);
    expect(await source.manager.count(EnMeaningEmbedding)).toBe(0);
    await writeFile(
      file,
      JSON.stringify({ ...line, embedding: [0, 1, 0] }) +
        '\n' +
        JSON.stringify({ ...line, meaning_sync_id: randomUUID() }) +
        '\n',
    );
    await expect(importMeaningEmbeddings(target.manager, file, manifest, 2)).rejects.toThrow(
      'embeddings_content_mismatch',
    );
    expect((await target.manager.findOneByOrFail(EnMeaningEmbedding, {})).embedding).toEqual([1, 0, 0]);
    const runner = target.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('LOCK TABLE en_meanings IN ROW EXCLUSIVE MODE');
      await writeFile(file, JSON.stringify(line) + '\n');
      let finished = false;
      const pending = importMeaningEmbeddings(target.manager, file, manifest, 1).then(() => {
        finished = true;
      });
      await target.query('SELECT pg_sleep(0.05)');
      expect(finished).toBe(false);
      await runner.rollbackTransaction();
      await pending;
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
