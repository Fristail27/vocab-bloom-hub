import { MigrationInterface, QueryRunner } from 'typeorm';

// Datasets of the instance's own (issue #540): the registry keeps the title
// of a dataset and the text of a license of the owner's own. The rows of the
// catalog's datasets get their titles from the catalog at the next start.
export class AddOwnDatasets1790000000000 implements MigrationInterface {
  name = 'AddOwnDatasets1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."datasets" ADD "title" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "public"."datasets" ADD "license_text" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."datasets" DROP COLUMN "license_text"`);
    await queryRunner.query(`ALTER TABLE "public"."datasets" DROP COLUMN "title"`);
  }
}
