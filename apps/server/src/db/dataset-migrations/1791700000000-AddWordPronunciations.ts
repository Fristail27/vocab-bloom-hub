import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWordPronunciations1791700000000 implements MigrationInterface {
  name = 'AddWordPronunciations1791700000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "en_pronunciations" (
      "id" SERIAL PRIMARY KEY,
      "word" integer NOT NULL REFERENCES "en_words"("id") ON DELETE CASCADE,
      "type" text NOT NULL,
      "text" text,
      "area_variant" text NOT NULL,
      "sort_order" integer NOT NULL,
      CONSTRAINT "CHK_EN_PRONUNCIATION_TYPE" CHECK ("type" IN ('ipa', 'enpr')),
      CONSTRAINT "CHK_EN_PRONUNCIATION_AREA" CHECK ("area_variant" IN ('common', 'british', 'american', 'australian')),
      CONSTRAINT "CHK_EN_PRONUNCIATION_ORDER" CHECK ("sort_order" >= 0)
    )`);
    await runner.query(
      `CREATE INDEX "IDX_EN_PRONUNCIATION_WORD_ORDER" ON "en_pronunciations" ("word", "sort_order")`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "en_pronunciations"');
  }
}
