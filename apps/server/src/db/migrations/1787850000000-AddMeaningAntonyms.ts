import { MigrationInterface, QueryRunner } from 'typeorm';

// Junction table behind EnMeaning.antonyms (issue #266): the same shape as
// en_meaning_synonyms — a meaning links to the headwords (en_entries) that
// mean the opposite. Both foreign keys cascade, so deleting a meaning or a
// word also drops its links.
export class AddMeaningAntonyms1787850000000 implements MigrationInterface {
  name = 'AddMeaningAntonyms1787850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "en_meaning_antonyms" ("meaning_id" integer NOT NULL, "word" character varying(128) NOT NULL, CONSTRAINT "PK_9edcdd03f44bd7abb70963ec0f3" PRIMARY KEY ("meaning_id", "word"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_439c07ca97e9496525fd16061b" ON "en_meaning_antonyms"  ("meaning_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_98cba058829d63b76ddfa20781" ON "en_meaning_antonyms"  ("word") `,
    );
    await queryRunner.query(
      `ALTER TABLE "en_meaning_antonyms" ADD CONSTRAINT "FK_439c07ca97e9496525fd16061b0" FOREIGN KEY ("meaning_id") REFERENCES "en_meanings"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_meaning_antonyms" ADD CONSTRAINT "FK_98cba058829d63b76ddfa20781e" FOREIGN KEY ("word") REFERENCES "en_entries"("word") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "en_meaning_antonyms" DROP CONSTRAINT "FK_98cba058829d63b76ddfa20781e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_meaning_antonyms" DROP CONSTRAINT "FK_439c07ca97e9496525fd16061b0"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_98cba058829d63b76ddfa20781"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_439c07ca97e9496525fd16061b"`);
    await queryRunner.query(`DROP TABLE "en_meaning_antonyms"`);
  }
}
