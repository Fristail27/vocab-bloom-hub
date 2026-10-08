import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddWordEtymologies1791500000000 implements MigrationInterface {
  name = 'AddWordEtymologies1791500000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "en_etymologies" (
      "id" SERIAL PRIMARY KEY, "word" integer NOT NULL REFERENCES "en_words"("id") ON DELETE CASCADE,
      "number" integer NOT NULL, "text" text NOT NULL
    )`);
    await runner.query(
      `CREATE UNIQUE INDEX "IDX_EN_ETYMOLOGY_WORD_NUMBER" ON "en_etymologies" ("word", "number")`,
    );
    await runner.query(
      `ALTER TABLE "en_meanings" ADD "etymology_id" integer REFERENCES "en_etymologies"("id") ON DELETE SET NULL`,
    );
    await runner.query(`CREATE INDEX "IDX_EN_MEANING_ETYMOLOGY" ON "en_meanings" ("etymology_id")`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "en_meanings" DROP COLUMN "etymology_id"`);
    await runner.query(`DROP TABLE "en_etymologies"`);
  }
}
