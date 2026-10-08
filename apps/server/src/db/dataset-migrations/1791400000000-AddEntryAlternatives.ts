import { MigrationInterface, QueryRunner } from 'typeorm';

/** Headword spelling links in each dataset, including public. */
export class AddEntryAlternatives1791400000000 implements MigrationInterface {
  name = 'AddEntryAlternatives1791400000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "en_entry_alternatives" (
      "word" varchar(128) NOT NULL,
      "alternative" varchar(128) NOT NULL,
      PRIMARY KEY ("word", "alternative"),
      FOREIGN KEY ("word") REFERENCES "en_entries"("word") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("alternative") REFERENCES "en_entries"("word") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await runner.query(`CREATE INDEX "IDX_ENTRY_ALTERNATIVES_WORD" ON "en_entry_alternatives" ("word")`);
    await runner.query(
      `CREATE INDEX "IDX_ENTRY_ALTERNATIVES_TARGET" ON "en_entry_alternatives" ("alternative")`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE "en_entry_alternatives"`);
  }
}
