import { MigrationInterface, QueryRunner } from 'typeorm';

// Junction table behind EnMeaning.synonyms (issue #259): a meaning links to the
// headwords (en_entries) that mean the same thing. Both foreign keys cascade,
// so deleting a meaning or a word also drops its links.
export class AddMeaningSynonyms1787504717645 implements MigrationInterface {
  name = 'AddMeaningSynonyms1787504717645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "en_meaning_synonyms" ("meaning_id" integer NOT NULL, "word" character varying(128) NOT NULL, CONSTRAINT "PK_e3edfead5b9b92fa6c33bb9eab8" PRIMARY KEY ("meaning_id", "word"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fd86fb9ad99990ec6de09533be" ON "en_meaning_synonyms"  ("meaning_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb95c21dd9e87e5d454a22ae86" ON "en_meaning_synonyms"  ("word") `,
    );
    await queryRunner.query(
      `ALTER TABLE "en_meaning_synonyms" ADD CONSTRAINT "FK_fd86fb9ad99990ec6de09533be8" FOREIGN KEY ("meaning_id") REFERENCES "en_meanings"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_meaning_synonyms" ADD CONSTRAINT "FK_cb95c21dd9e87e5d454a22ae869" FOREIGN KEY ("word") REFERENCES "en_entries"("word") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "en_meaning_synonyms" DROP CONSTRAINT "FK_cb95c21dd9e87e5d454a22ae869"`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_meaning_synonyms" DROP CONSTRAINT "FK_fd86fb9ad99990ec6de09533be8"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_cb95c21dd9e87e5d454a22ae86"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fd86fb9ad99990ec6de09533be"`);
    await queryRunner.query(`DROP TABLE "en_meaning_synonyms"`);
  }
}
