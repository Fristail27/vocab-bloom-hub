import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { AddMeaningEmbeddings1792700000000 } from '../src/db/dataset-migrations/1792700000000-AddMeaningEmbeddings';
import { embeddingInputHash, embeddingProfileId, type EmbeddingProfileT } from '../src/core/embeddings/profile';
import { pgvectorSupport } from '../src/core/embeddings/pgvector';

const profile: EmbeddingProfileT = {
  model: 'fixture',
  revision: 'fixed',
  dimensions: 3,
  normalization: 'l2',
  document_format: 'meaning-v1',
  query_format: 'query-v1',
};
const profileId = embeddingProfileId(profile);
const inputHash = embeddingInputHash('fixture');
const migration = new AddMeaningEmbeddings1792700000000();
const withVector = process.env.TEST_PGVECTOR === 'true';

/** Own temporary database: no extension/schema mutation of the configured instance. */
describe('meaning embedding migrations and pgvector', () => {
  let admin: DataSource;
  let ds: DataSource;
  let runner: QueryRunner;
  const database = `vbh_embedding_test_${randomUUID().replaceAll('-', '')}`;
  beforeAll(async () => {
    admin = await new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [],
    }).initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${database}`;
    ds = await new DataSource({ type: 'postgres', url: url.toString(), entities: [] }).initialize();
    runner = ds.createQueryRunner();
    await runner.connect();
    for (const schema of ['dataset_a', 'dataset_b']) {
      await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET search_path TO "${schema}", public`);
      await runner.query('CREATE TABLE en_meanings (id integer PRIMARY KEY)');
      await migration.up(runner);
      await runner.query('INSERT INTO en_meanings VALUES (1), (2), (3)');
      await runner.query('INSERT INTO en_embedding_profiles VALUES ($1,$2,$3,$4,$5,$6,$7)', [
        profileId,
        profile.model,
        profile.revision,
        3,
        'l2',
        profile.document_format,
        profile.query_format,
      ]);
    }
    await runner.query('SET search_path TO dataset_a, public');
  });
  afterAll(async () => {
    await runner?.release();
    if (ds?.isInitialized) await ds.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.destroy();
    }
  });

  const insert = (id: number, vector: string, dimensions = 3, hash = inputHash, modelId = profileId) =>
    runner.query('INSERT INTO en_meaning_embeddings VALUES ($1,$2,$3,$4,$5::real[])', [
      modelId,
      id,
      dimensions,
      hash,
      vector,
    ]);

  it('migrates and stores vectors without the extension or the feature flag', async () => {
    expect(await pgvectorSupport(runner.manager)).toEqual({
      available: false,
      reason: 'extension_not_installed',
    });
    await insert(1, '{1,0,0}');
    expect(await runner.query('SELECT embedding FROM en_meaning_embeddings')).toEqual([
      { embedding: [1, 0, 0] },
    ]);
    expect(await runner.query('SELECT * FROM dataset_b.en_meaning_embeddings')).toEqual([]);
  });

  it('rejects malformed vectors, metadata mismatches and missing meanings at the database boundary', async () => {
    for (const vector of [
      '{}',
      '{1,0}',
      '{NaN,0,0}',
      '{Infinity,0,0}',
      '{-Infinity,0,0}',
      '{NULL,0,0}',
      '{{1,0,0}}',
      '[0:2]={1,0,0}',
    ]) {
      await expect(insert(2, vector)).rejects.toThrow();
    }
    await expect(insert(2, '{1,0,0}', 2)).rejects.toThrow();
    await expect(insert(2, '{1,0,0}', 3, 'bad-hash')).rejects.toThrow();
    await expect(insert(2, '{1,0,0}', 3, inputHash, 'f'.repeat(64))).rejects.toThrow();
    await expect(insert(99, '{1,0,0}')).rejects.toThrow();
    await expect(insert(1, '{1,0,0}')).rejects.toThrow();
  });

  it('cascades deletion and permits independent model generations', async () => {
    const otherId = embeddingProfileId({ ...profile, revision: 'next' });
    await runner.query(
      'INSERT INTO en_embedding_profiles SELECT $1,model,$2,dimensions,normalization,document_format,query_format FROM en_embedding_profiles WHERE id=$3',
      [otherId, 'next', profileId],
    );
    await insert(2, '{0,1,0}');
    await insert(2, '{0,0,1}', 3, inputHash, otherId);
    await runner.query('DELETE FROM en_meanings WHERE id=2');
    expect(await runner.query('SELECT * FROM en_meaning_embeddings WHERE meaning_id=2')).toEqual([]);
    await insert(3, '{0,0,1}', 3, inputHash, otherId);
    await runner.query('DELETE FROM en_embedding_profiles WHERE id=$1', [otherId]);
    expect(await runner.query('SELECT * FROM en_meaning_embeddings WHERE profile_id=$1', [otherId])).toEqual(
      [],
    );
  });

  it('reverts and reapplies only the selected dataset tables', async () => {
    await runner.query('SET search_path TO dataset_b, public');
    await migration.down(runner);
    expect(await runner.query("SELECT to_regclass('dataset_b.en_meaning_embeddings') AS name")).toEqual([
      { name: null },
    ]);
    expect(await runner.query('SELECT count(*)::int AS count FROM dataset_a.en_meaning_embeddings')).toEqual([
      { count: 1 },
    ]);
    await migration.up(runner);
    await runner.query('SET search_path TO dataset_a, public');
  });

  (withVector ? it : it.skip)(
    'adds pgvector later without losing data, and indexes real[] for cosine search',
    async () => {
      // A non-public extension schema also exercises explicit qualification.
      await runner.query('CREATE SCHEMA vector_extension');
      await runner.query('CREATE EXTENSION vector WITH SCHEMA vector_extension');
      const support = await pgvectorSupport(runner.manager);
      expect(support).toMatchObject({ available: true, schema: 'vector_extension' });
      await insert(3, '{0,0,1}');
      await runner.query(`CREATE INDEX embedding_fixture_hnsw ON en_meaning_embeddings
      USING hnsw ((embedding::vector_extension.vector(3)) vector_extension.vector_cosine_ops)
      WHERE profile_id = '${profileId}'`);
      const sql = `SELECT meaning_id FROM en_meaning_embeddings WHERE profile_id = '${profileId}'
      ORDER BY embedding::vector_extension.vector(3) OPERATOR(vector_extension.<=>) $1::vector_extension.vector LIMIT 1`;
      expect(await runner.query(sql, ['[1,0,0]'])).toEqual([{ meaning_id: 1 }]);
      await runner.query('SET enable_seqscan = off');
      try {
        const plan = await runner.query('EXPLAIN ' + sql, ['[1,0,0]']);
        expect(JSON.stringify(plan)).toContain('embedding_fixture_hnsw');
      } finally {
        await runner.query('RESET enable_seqscan');
      }
      expect(await runner.query('SELECT * FROM dataset_b.en_meaning_embeddings')).toEqual([]);
    },
  );
});
