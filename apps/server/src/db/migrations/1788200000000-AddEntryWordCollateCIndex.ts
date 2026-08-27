import { MigrationInterface, QueryRunner } from 'typeorm';

// The public list (GET /api/v1/words, issue #272) orders entries by the
// headword's bytes — COLLATE "C" — so the order does not depend on the
// database locale (en_US.UTF-8 ignores spaces at the first level, putting
// "aaron burr" before "a bag of wind") and matches SQLite. The index lets the
// ORDER BY ... COLLATE "C" LIMIT n and the keyset cursor comparison walk the
// entries in that order instead of sorting them per request.
export class AddEntryWordCollateCIndex1788200000000 implements MigrationInterface {
  name = 'AddEntryWordCollateCIndex1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_EN_ENTRY_WORD_C" ON "en_entries" ("word" COLLATE "C")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_ENTRY_WORD_C"`);
  }
}
