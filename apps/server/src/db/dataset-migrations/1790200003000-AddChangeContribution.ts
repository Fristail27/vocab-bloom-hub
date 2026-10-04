import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChangeContribution1790200003000 implements MigrationInterface {
  name = 'AddChangeContribution1790200003000';

  async up(runner: QueryRunner): Promise<void> {
    // Earlier edits carry no snapshot of their terms. Do not invent historical terms.
    await runner.query(`ALTER TABLE "en_changes" ADD COLUMN "contribution" text`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "en_changes" DROP COLUMN "contribution"`);
  }
}
