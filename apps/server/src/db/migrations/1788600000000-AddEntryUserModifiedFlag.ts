import { MigrationInterface, QueryRunner } from 'typeorm';

// Entries edited by the admin are flagged (issue #328) so a dictionary
// update replaces only unflagged entries and keeps the owner's changes.
export class AddEntryUserModifiedFlag1788600000000 implements MigrationInterface {
  name = 'AddEntryUserModifiedFlag1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "en_entries" ADD "user_modified" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "en_entries" DROP COLUMN "user_modified"`);
  }
}
