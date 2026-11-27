import type { MigrationInterface, QueryRunner } from 'typeorm';

const tables = [
  'dictionary_en_entries',
  'dictionary_en_words',
  'dictionary_en_meanings',
  'dictionary_en_meanings_translations',
  'dictionary_en_short_translations',
];

export class IndexDictionaryUpdatedAt1795700000000 implements MigrationInterface {
  name = 'IndexDictionaryUpdatedAt1795700000000';

  async up(runner: QueryRunner): Promise<void> {
    for (const table of tables) {
      await runner.query(
        `CREATE INDEX "${table}_updated_at_idx" ON public."${table}" (dataset_id, "updateAt" DESC)`,
      );
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    for (const table of tables) {
      await runner.query(`DROP INDEX public."${table}_updated_at_idx"`);
    }
  }
}
