import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Storage must migrate even when pgvector is absent and semantic search is off. */
export class AddMeaningEmbeddings1792700000000 implements MigrationInterface {
  name = 'AddMeaningEmbeddings1792700000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "en_embedding_profiles" (
      "id" varchar(64) PRIMARY KEY,
      "model" varchar(256) NOT NULL,
      "revision" varchar(256) NOT NULL,
      "dimensions" integer NOT NULL,
      "normalization" varchar(8) NOT NULL,
      "document_format" varchar(256) NOT NULL,
      "query_format" varchar(256) NOT NULL,
      CONSTRAINT "UQ_EN_EMBEDDING_PROFILE_DIMENSIONS" UNIQUE ("id", "dimensions"),
      CONSTRAINT "CHK_EN_EMBEDDING_PROFILE_DIMENSIONS" CHECK ("dimensions" BETWEEN 1 AND 2000),
      CONSTRAINT "CHK_EN_EMBEDDING_PROFILE_NORMALIZATION" CHECK ("normalization" = 'l2'),
      CONSTRAINT "CHK_EN_EMBEDDING_PROFILE_ID" CHECK ("id" ~ '^[a-f0-9]{64}$')
    )`);
    await runner.query(`CREATE TABLE "en_meaning_embeddings" (
      "profile_id" varchar(64) NOT NULL,
      "meaning_id" integer NOT NULL,
      "dimensions" integer NOT NULL,
      "input_hash" varchar(64) NOT NULL,
      "embedding" real[] NOT NULL,
      PRIMARY KEY ("profile_id", "meaning_id"),
      FOREIGN KEY ("profile_id", "dimensions") REFERENCES "en_embedding_profiles" ("id", "dimensions") ON DELETE CASCADE,
      FOREIGN KEY ("meaning_id") REFERENCES "en_meanings" ("id") ON DELETE CASCADE,
      CONSTRAINT "CHK_EN_MEANING_EMBEDDING_HASH" CHECK ("input_hash" ~ '^[a-f0-9]{64}$'),
      CONSTRAINT "CHK_EN_MEANING_EMBEDDING_VECTOR" CHECK (
        array_ndims("embedding") = 1 AND array_lower("embedding", 1) = 1
        AND cardinality("embedding") = "dimensions"
        AND array_position("embedding", NULL) IS NULL
        AND array_position("embedding", 'NaN'::real) IS NULL
        AND array_position("embedding", 'Infinity'::real) IS NULL
        AND array_position("embedding", '-Infinity'::real) IS NULL
      )
    )`);
    await runner.query(
      `CREATE INDEX "IDX_EN_MEANING_EMBEDDINGS_MEANING" ON "en_meaning_embeddings" ("meaning_id")`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "en_meaning_embeddings"');
    await runner.query('DROP TABLE "en_embedding_profiles"');
  }
}
