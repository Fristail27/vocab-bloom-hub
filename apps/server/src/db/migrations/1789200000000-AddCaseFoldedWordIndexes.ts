import { MigrationInterface, QueryRunner } from 'typeorm';

// The public list, its prefix filter and the search tiers compare and order
// headwords case-insensitively (issue #440): the grammar patterns keep their
// sentence capitals ("It’s the first time …") and used to sort before "a" and
// hide from a lower-case prefix. LOWER(word) COLLATE "C" replaces
// word COLLATE "C" in every hot query, so the byte-order indexes follow: an
// expression index on en_entries for the search and admin lookups, and
// (LOWER(word) COLLATE "C", id) on en_words for the list order and cursor.
// The plain COLLATE "C" indexes have no reader left and go.
export class AddCaseFoldedWordIndexes1789200000000 implements MigrationInterface {
  name = 'AddCaseFoldedWordIndexes1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_ENTRY_WORD_LOWER_C" ON "en_entries" ((LOWER("word") COLLATE "C"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_WORD_LOWER_C" ON "en_words" ((LOWER("word") COLLATE "C"), "id")`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_ENTRY_WORD_C"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_WORD_C"`);
    // An expression index has planner statistics only once the table is
    // analysed; until then LOWER(word) = :w is estimated at 0.5 % of the table
    // and a one-row lookup gets a parallel bitmap plan (~5 ms of worker
    // start-up instead of 0.1 ms). Autovacuum would get there eventually.
    await queryRunner.query(`ANALYZE "en_entries"`);
    await queryRunner.query(`ANALYZE "en_words"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_EN_WORD_C" ON "en_words" ("word" COLLATE "C", "id")`);
    await queryRunner.query(`CREATE INDEX "IDX_EN_ENTRY_WORD_C" ON "en_entries" ("word" COLLATE "C")`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_WORD_LOWER_C"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_ENTRY_WORD_LOWER_C"`);
  }
}
