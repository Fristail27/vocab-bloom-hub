import { MigrationInterface, QueryRunner } from 'typeorm';

// Reader feedback on the dictionary data (issue #327): reports filed through
// the public API, worked by the admin in the moderation queue. word_id nulls
// out when a dictionary update replaces the entry's rows (#328) — the
// headword string stays the durable pointer.
export class AddSuggestions1788700000000 implements MigrationInterface {
  name = 'AddSuggestions1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "suggestions" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "headword" character varying(128) NOT NULL,
        "word_id" integer,
        "message" text NOT NULL,
        "dataset_version" character varying(64),
        "status" character varying NOT NULL DEFAULT 'new',
        CONSTRAINT "PK_suggestions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_suggestions_word" FOREIGN KEY ("word_id")
          REFERENCES "en_words"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_SUGGESTION_STATUS" ON "suggestions" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_SUGGESTION_HEADWORD" ON "suggestions" ("headword")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_SUGGESTION_HEADWORD"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_SUGGESTION_STATUS"`);
    await queryRunner.query(`DROP TABLE "suggestions"`);
  }
}
