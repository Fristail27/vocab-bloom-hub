import { MigrationInterface, QueryRunner } from 'typeorm';
import { defaultOrigins } from '../../../core/utils/provenance';
import type { ProvenanceDatasetT } from '../../../core/utils/provenance';

export class AddWordOrigins1790200000000 implements MigrationInterface {
  name = 'AddWordOrigins1790200000000';
  async up(runner: QueryRunner): Promise<void> {
    // Earlier builds recorded this migration under AddArticleOrigins. Keep
    // their columns and snapshots when the renamed migration runs once more.
    await runner.query(`ALTER TABLE "en_words" ADD COLUMN IF NOT EXISTS "origins" text`);
    await runner.query(
      `ALTER TABLE "en_changes" ADD COLUMN IF NOT EXISTS "inherited_from" text, ADD COLUMN IF NOT EXISTS "reason" text`,
    );
    const [dataset] = (await runner.query(
      `SELECT * FROM "public"."datasets" WHERE "schema" = current_schema()`,
    )) as ProvenanceDatasetT[];
    // A new schema has no registry entry yet and no words. Legacy rows get
    // the known terms, never a guessed edit or acquisition timestamp.
    if (dataset) {
      // Raw SQL does not hydrate TypeORM's simple-json text columns.
      if (typeof dataset.origins === 'string') dataset.origins = JSON.parse(dataset.origins);
      await runner.query(
        `UPDATE "en_words" SET "origins" = $1 WHERE "baseFormId" IS NULL AND "origins" IS NULL`,
        [JSON.stringify(defaultOrigins(dataset))],
      );
    }
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "en_changes" DROP COLUMN "reason", DROP COLUMN "inherited_from"`);
    await runner.query(`ALTER TABLE "en_words" DROP COLUMN "origins"`);
  }
}
