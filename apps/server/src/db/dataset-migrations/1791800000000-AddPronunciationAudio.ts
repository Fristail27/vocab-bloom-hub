import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPronunciationAudio1791800000000 implements MigrationInterface {
  name = 'AddPronunciationAudio1791800000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "en_pronunciation_audio" (
      "id" SERIAL PRIMARY KEY,
      "pronunciation" integer NOT NULL REFERENCES "en_pronunciations"("id") ON DELETE CASCADE,
      "url" text NOT NULL, "source_url" text, "attribution" text,
      "licenses" text NOT NULL DEFAULT '[]', "sort_order" integer NOT NULL,
      CONSTRAINT "CHK_EN_AUDIO_ORDER" CHECK ("sort_order" >= 0)
    )`);
    await runner.query(
      `CREATE INDEX "IDX_EN_AUDIO_PRONUNCIATION_ORDER" ON "en_pronunciation_audio" ("pronunciation", "sort_order")`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "en_pronunciation_audio"');
  }
}
