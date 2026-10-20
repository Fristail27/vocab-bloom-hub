import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentReviews1792500000000 implements MigrationInterface {
  name = 'AddContentReviews1792500000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "en_content_reviews" (
      "scope" varchar(32) NOT NULL,
      "identity" varchar(36) NOT NULL,
      "content" text NOT NULL,
      "checked_at" timestamp NOT NULL,
      PRIMARY KEY ("scope", "identity")
    )`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "en_content_reviews"');
  }
}
