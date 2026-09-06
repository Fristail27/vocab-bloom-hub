import { MigrationInterface, QueryRunner } from 'typeorm';

// Spanish as a translation language (issue #410): the two Postgres enum types
// behind `language` gain the value. `ADD VALUE` cannot be undone, so the
// revert rebuilds each type without it — after deleting the Spanish rows,
// which is what going back to a single language means.
const TABLES = [
  { table: 'en_meanings_translations', type: 'en_meanings_translations_language_enum' },
  { table: 'en_short_translations', type: 'en_short_translations_language_enum' },
] as const;

export class AddSpanishTranslationLanguage1788900000000 implements MigrationInterface {
  name = 'AddSpanishTranslationLanguage1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { type } of TABLES) {
      await queryRunner.query(`ALTER TYPE "public"."${type}" ADD VALUE IF NOT EXISTS 'es'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, type } of TABLES) {
      await queryRunner.query(`DELETE FROM "${table}" WHERE "language" = 'es'`);
      await queryRunner.query(`ALTER TYPE "public"."${type}" RENAME TO "${type}_old"`);
      await queryRunner.query(`CREATE TYPE "public"."${type}" AS ENUM('ru')`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "language" TYPE "public"."${type}" USING "language"::text::"public"."${type}"`,
      );
      await queryRunner.query(`DROP TYPE "public"."${type}_old"`);
    }
  }
}
