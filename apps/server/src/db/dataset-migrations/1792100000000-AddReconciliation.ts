import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReconciliation1792100000000 implements MigrationInterface {
  name = 'AddReconciliation1792100000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'CREATE TABLE "reconciliation_identity" ("key" varchar(8) PRIMARY KEY, "lineage" varchar(64) NOT NULL)',
    );
    await runner.query('ALTER TABLE "en_changes" ADD COLUMN "operation" text');
    for (const table of [
      'en_words',
      'en_meanings',
      'en_meanings_translations',
      'en_short_translations',
      'en_etymologies',
      'en_pronunciations',
      'en_pronunciation_audio',
    ]) {
      await runner.query(`ALTER TABLE "${table}" ADD COLUMN "sync_id" varchar(36)`);
    }
    await runner.query(`CREATE TABLE "reconciliation_revisions" (
      "id" varchar(64) PRIMARY KEY, "lineage" varchar(64) NOT NULL,
      "metadata" text NOT NULL, "complete" boolean NOT NULL, "sealed" boolean NOT NULL DEFAULT false
    )`);
    await runner.query(`CREATE TABLE "reconciliation_records" (
      "revision" varchar(64) NOT NULL, "headword" varchar(128) NOT NULL,
      "content" text, "hash" varchar(64) NOT NULL, "history" text NOT NULL DEFAULT '[]', "versions" text NOT NULL DEFAULT '{}',
      PRIMARY KEY ("revision", "headword")
    )`);
    await runner.query(`CREATE TABLE "reconciliation_baselines" (
      "lineage" varchar(64) PRIMARY KEY, "revision" varchar(64) NOT NULL
    )`);
    await runner.query(`CREATE TABLE "reconciliation_plans" (
      "id" varchar(36) PRIMARY KEY, "kind" varchar(16) NOT NULL, "status" varchar(16) NOT NULL,
      "lineage" varchar(64) NOT NULL, "baseline" varchar(64), "local" varchar(64) NOT NULL,
      "incoming" varchar(64) NOT NULL, "created_at" varchar(32) NOT NULL,
      "applied_at" varchar(32), "outcome" text
    )`);
    await runner.query(`CREATE TABLE "reconciliation_items" (
      "plan" varchar(36) NOT NULL, "headword" varchar(128) NOT NULL,
      "category" varchar(16) NOT NULL, "comparison" text NOT NULL, "decisions" text NOT NULL,
      "result" text NOT NULL, "remaining" integer NOT NULL, "version" integer NOT NULL DEFAULT 0,
      PRIMARY KEY ("plan", "headword")
    )`);
    await runner.query(`CREATE INDEX "IDX_RECONCILIATION_ITEMS_CATEGORY"
      ON "reconciliation_items" ("plan", "category", "headword")`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "en_changes" DROP COLUMN "operation"');
    for (const table of [
      'en_words',
      'en_meanings',
      'en_meanings_translations',
      'en_short_translations',
      'en_etymologies',
      'en_pronunciations',
      'en_pronunciation_audio',
    ]) {
      await runner.query(`ALTER TABLE "${table}" DROP COLUMN "sync_id"`);
    }
    for (const table of [
      'reconciliation_identity',
      'reconciliation_items',
      'reconciliation_plans',
      'reconciliation_baselines',
      'reconciliation_records',
      'reconciliation_revisions',
    ]) {
      await runner.query(`DROP TABLE "${table}"`);
    }
  }
}
