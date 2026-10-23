import '../../../modules/EnModule/__tests__/helpers/clearDatabaseUrl';
import { DataSource } from 'typeorm';
import { DICTIONARY_ENTITIES } from '../../../modules/EnModule/entities/dictionary-entities';
import { EnMeaning } from '../../../modules/EnModule/entities/en_meaning.entity';
import { EnEmbeddingProfile } from '../../../modules/EnModule/entities/en_embedding_profile.entity';
import { EnMeaningEmbedding } from '../../../modules/EnModule/entities/en_meaning_embedding.entity';
import { embeddingInputHash, embeddingProfileId, type EmbeddingProfileT } from '../profile';
import { pgvectorSupport } from '../pgvector';

const profile: EmbeddingProfileT = {
  model: 'test',
  revision: 'fixed',
  dimensions: 3,
  normalization: 'l2',
  document_format: 'meaning-v1',
  query_format: 'query-v1',
};

describe('embedding storage without pgvector (SQLite)', () => {
  let ds: DataSource;
  beforeAll(async () => {
    ds = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: DICTIONARY_ENTITIES,
      synchronize: true,
      prepareDatabase: (db) => {
        db.pragma('foreign_keys = ON');
      },
    }).initialize();
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  it('stores imported vectors with semantic search off, preserves them on sync, and cascades meaning deletion', async () => {
    expect(await pgvectorSupport(ds.manager)).toEqual({ available: false, reason: 'unsupported_database' });
    const meaning = await ds.getRepository(EnMeaning).save({
      title: 'fixture',
      definition: 'fixture definition',
      sort_order: 0,
    });
    const id = embeddingProfileId(profile);
    await ds.getRepository(EnEmbeddingProfile).insert({ ...profile, id });
    const row = {
      profile_id: id,
      meaning_id: meaning.id,
      dimensions: 3,
      input_hash: embeddingInputHash('fixture'),
      embedding: [1, 0, 0],
    };
    await ds.getRepository(EnMeaningEmbedding).insert(row);
    await ds.synchronize();
    expect(await ds.getRepository(EnMeaningEmbedding).findOneByOrFail({ meaning_id: meaning.id })).toEqual(row);
    await expect(
      ds.getRepository(EnMeaningEmbedding).insert({ ...row, meaning_id: meaning.id + 1 }),
    ).rejects.toThrow();
    await expect(
      ds.getRepository(EnMeaningEmbedding).update({ meaning_id: meaning.id }, { dimensions: 2 }),
    ).rejects.toThrow();
    await ds.getRepository(EnMeaning).delete(meaning.id);
    expect(await ds.getRepository(EnMeaningEmbedding).count()).toBe(0);
  });
});
