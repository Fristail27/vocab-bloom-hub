import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDatasetOrigins1790200000000 implements MigrationInterface {
  name = 'AddDatasetOrigins1790200000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "public"."datasets" ADD "description" text, ADD "origins" text`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "public"."datasets" DROP COLUMN "origins", DROP COLUMN "description"`);
  }
}
