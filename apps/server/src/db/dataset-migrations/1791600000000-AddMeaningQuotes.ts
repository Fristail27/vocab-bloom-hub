import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeaningQuotes1791600000000 implements MigrationInterface {
  name = 'AddMeaningQuotes1791600000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "en_meanings" ADD "quotes" text');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "en_meanings" DROP COLUMN "quotes"');
  }
}
