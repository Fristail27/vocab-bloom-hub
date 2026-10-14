import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDatasetVisibility1792000000000 implements MigrationInterface {
  name = 'AddDatasetVisibility1792000000000';

  async up(runner: QueryRunner): Promise<void> {
    // Preserve visibility on upgrades. New installations/forks explicitly set false.
    await runner.query(`ALTER TABLE "public"."datasets"
      ADD "is_public" boolean NOT NULL DEFAULT true,
      ADD "visibility_updated_at" timestamptz`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "public"."datasets"
      DROP COLUMN "visibility_updated_at", DROP COLUMN "is_public"`);
  }
}
