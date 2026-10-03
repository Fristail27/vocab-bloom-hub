import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDatasetTermsUpdatedAt1790200002000 implements MigrationInterface {
  name = 'AddDatasetTermsUpdatedAt1790200002000';

  async up(runner: QueryRunner): Promise<void> {
    // Early builds already recorded AddDatasetOrigins without this column.
    // Later builds added it there, so preserve a timestamp they have written.
    await runner.query(
      `ALTER TABLE "public"."datasets" ADD COLUMN IF NOT EXISTS "terms_updated_at" timestamptz`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "public"."datasets" DROP COLUMN "terms_updated_at"`);
  }
}
