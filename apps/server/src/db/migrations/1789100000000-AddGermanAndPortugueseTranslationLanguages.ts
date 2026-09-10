import { MigrationInterface, QueryRunner } from 'typeorm';

// German and Portuguese as translation languages (issue #449), the way
// Spanish (#410) and French (#445) were added: the two Postgres enum types
// behind `language` gain the values. `ADD VALUE` cannot be undone, so the
// revert rebuilds each type without them — after deleting their rows, which
// is what going back means.
const LANGUAGES = ['de', 'pt'] as const;
const TABLES = [
  { table: 'en_meanings_translations', type: 'en_meanings_translations_language_enum' },
  { table: 'en_short_translations', type: 'en_short_translations_language_enum' },
] as const;

export class AddGermanAndPortugueseTranslationLanguages1789100000000 implements MigrationInterface {
  name = 'AddGermanAndPortugueseTranslationLanguages1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { type } of TABLES) {
      for (const language of LANGUAGES) {
        await queryRunner.query(`ALTER TYPE "public"."${type}" ADD VALUE IF NOT EXISTS '${language}'`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, type } of TABLES) {
      await queryRunner.query(`DELETE FROM "${table}" WHERE "language" IN ('de', 'pt')`);
      await queryRunner.query(`ALTER TYPE "public"."${type}" RENAME TO "${type}_old"`);
      await queryRunner.query(`CREATE TYPE "public"."${type}" AS ENUM('ru', 'es', 'fr')`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "language" TYPE "public"."${type}" USING "language"::text::"public"."${type}"`,
      );
      await queryRunner.query(`DROP TYPE "public"."${type}_old"`);
    }
  }
}
