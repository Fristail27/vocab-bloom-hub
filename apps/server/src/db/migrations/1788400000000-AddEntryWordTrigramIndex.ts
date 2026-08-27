import { MigrationInterface, QueryRunner } from 'typeorm';

// Trigram search (issue #278): the substring, suffix and word-boundary
// tiers of the search (`%term`, `%term%`, `% term %`) scanned en_entries
// sequentially — a btree cannot serve them. A GIN index over the trigrams
// of the headword serves those LIKEs and the similarity operator (`%`) of
// the fuzzy tier that answers typos. pg_trgm is a trusted extension: the
// database owner may create it without superuser rights (Postgres 13+).
export class AddEntryWordTrigramIndex1788400000000 implements MigrationInterface {
  name = 'AddEntryWordTrigramIndex1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_ENTRY_WORD_TRGM" ON "en_entries" USING GIN ("word" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // the extension stays: dropping it would also drop anything else that came to rely on it
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_ENTRY_WORD_TRGM"`);
  }
}
