import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingEmbeddings1792700001000 implements MigrationInterface {
  name = 'AddPendingEmbeddings1792700001000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('CREATE INDEX "IDX_EN_MEANING_SYNC_ID" ON "en_meanings" ("sync_id")');
    await runner.query(`CREATE TABLE "reconciliation_embeddings" (
      "plan" varchar(36) NOT NULL,
      "profile_id" varchar(64) NOT NULL,
      "ordinal" integer NOT NULL,
      "payload" text NOT NULL,
      PRIMARY KEY ("plan", "profile_id", "ordinal")
    )`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "reconciliation_embeddings"');
    await runner.query('DROP INDEX "IDX_EN_MEANING_SYNC_ID"');
  }
}
