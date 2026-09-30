import { MigrationInterface, QueryRunner } from 'typeorm';

// Whether the owner created a dataset (issue #540). The mark is kept, not
// derived from the catalog: a later entry of the catalog under the same name
// must not take a dataset of the owner's for its own and put it under the
// terms of a source. A row this version's catalog does not know was created
// by an admin.
const CATALOG_NAMES = ['default', 'wiktionary', 'wordnet', 'wordnet_princeton'];

export class AddOwnDatasetMark1790100000000 implements MigrationInterface {
  name = 'AddOwnDatasetMark1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."datasets" ADD "own" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`UPDATE "public"."datasets" SET "own" = true WHERE NOT ("name" = ANY($1))`, [
      CATALOG_NAMES,
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."datasets" DROP COLUMN "own"`);
  }
}
