import { MigrationInterface, QueryRunner } from 'typeorm';

// Indexes behind the public list / random filters (issue #279). On the full
// dictionary the list scanned en_words sequentially for every selective
// filter (a category page took ~250 ms); a btree per filter column lets the
// planner bitmap-AND them, the GIN over the categories array serves the
// overlap operator (`categories && ARRAY[...]`), and (word COLLATE "C", id)
// is the order the list pages in, so an unselective page is an index walk
// with no join and no sort.
export class AddWordFilterIndexes1788300000000 implements MigrationInterface {
  name = 'AddWordFilterIndexes1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_EN_WORD_LEVEL" ON "en_words" ("word_level")`);
    await queryRunner.query(`CREATE INDEX "IDX_EN_LANGUAGE_REGISTER" ON "en_words" ("language_register")`);
    await queryRunner.query(`CREATE INDEX "IDX_EN_AREA_VARIANT" ON "en_words" ("area_variant")`);
    await queryRunner.query(`CREATE INDEX "IDX_EN_FORM_OF_WORD" ON "en_words" ("form_of_word")`);
    await queryRunner.query(`CREATE INDEX "IDX_EN_CATEGORIES" ON "en_words" USING GIN ("categories")`);
    await queryRunner.query(`CREATE INDEX "IDX_EN_WORD_C" ON "en_words" ("word" COLLATE "C", "id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_WORD_C"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_CATEGORIES"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_FORM_OF_WORD"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_AREA_VARIANT"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_LANGUAGE_REGISTER"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_WORD_LEVEL"`);
  }
}
