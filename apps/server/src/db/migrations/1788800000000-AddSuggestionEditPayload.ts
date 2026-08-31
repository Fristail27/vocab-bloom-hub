import { MigrationInterface, QueryRunner } from 'typeorm';

// The second suggestion flow (issue #327): the reader edits the word form
// as a whole, so one suggestion carries every touched target in `edits`
// ([{ target_type, target_id, changes: { field: { before, after } } }])
// and the admin applies them all in one click. The target ids carry no FK —
// the stored proposal must survive a target's deletion so the admin can
// still read what was suggested.
export class AddSuggestionEditPayload1788800000000 implements MigrationInterface {
  name = 'AddSuggestionEditPayload1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "suggestions" ADD "kind" character varying NOT NULL DEFAULT 'report'`);
    await queryRunner.query(`ALTER TABLE "suggestions" ADD "edits" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "suggestions" DROP COLUMN "edits"`);
    await queryRunner.query(`ALTER TABLE "suggestions" DROP COLUMN "kind"`);
  }
}
