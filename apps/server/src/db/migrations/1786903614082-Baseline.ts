import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1786903614082 implements MigrationInterface {
  name = 'Baseline1786903614082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Every CREATE TYPE is preceded by a non-cascading DROP TYPE IF EXISTS:
    // a database wiped with plain DROP TABLE keeps its enum types around, and
    // those orphans used to make this baseline fail with "type already
    // exists". A type still used by real tables (a legacy schema that should
    // be adopted with `migration:run --fake`) makes the DROP fail loudly
    // instead of destroying columns.
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_meanings_translations_language_enum"`);
    await queryRunner.query(`CREATE TYPE "public"."en_meanings_translations_language_enum" AS ENUM('ru')`);
    await queryRunner.query(
      `CREATE TABLE "en_meanings_translations" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updateAt" TIMESTAMP NOT NULL DEFAULT now(), "language" "public"."en_meanings_translations_language_enum" NOT NULL, "title" text NOT NULL, "definition" text NOT NULL, "variants_of_words" text array NOT NULL DEFAULT '{}', "meaning" integer, CONSTRAINT "PK_728f8023d2d887223c84d8ca38a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_MEANING_TRANSLATION_LANGUAGE" ON "en_meanings_translations"  ("language") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_MEANING_TRANSLATION_MEANING" ON "en_meanings_translations"  ("meaning") `,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_meanings_categories_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_meanings_categories_enum" AS ENUM('scientific', 'technical', 'medical', 'legal', 'business', 'IT', 'art', 'political', 'sport', 'culinary')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_meanings_meaning_level_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_meanings_meaning_level_enum" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_meanings_area_variant_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_meanings_area_variant_enum" AS ENUM('common', 'british', 'american', 'australian')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_meanings_language_register_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_meanings_language_register_enum" AS ENUM('formal', 'informal', 'slang')`,
    );
    await queryRunner.query(
      `CREATE TABLE "en_meanings" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updateAt" TIMESTAMP NOT NULL DEFAULT now(), "categories" "public"."en_meanings_categories_enum" array NOT NULL DEFAULT '{}', "meaning_level" "public"."en_meanings_meaning_level_enum", "area_variant" "public"."en_meanings_area_variant_enum" NOT NULL DEFAULT 'common', "language_register" "public"."en_meanings_language_register_enum", "sort_order" integer NOT NULL, "title" text NOT NULL, "definition" text NOT NULL, "is_obsolete" boolean NOT NULL DEFAULT false, "examples" text array, "word" integer, CONSTRAINT "PK_71226dd436f6bdf7138e1b2ea5f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_MEANING_WORD_SORT" ON "en_meanings"  ("word", "sort_order") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_EN_MEANING_WORD" ON "en_meanings"  ("word") `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_short_translations_language_enum"`);
    await queryRunner.query(`CREATE TYPE "public"."en_short_translations_language_enum" AS ENUM('ru')`);
    await queryRunner.query(
      `CREATE TABLE "en_short_translations" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updateAt" TIMESTAMP NOT NULL DEFAULT now(), "description" text NOT NULL, "language" "public"."en_short_translations_language_enum" NOT NULL, "variants_of_words" text array NOT NULL DEFAULT '{}', "word" integer, CONSTRAINT "PK_e4c646d7a3c393bb665bf72c3d7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_SHORT_TRANSLATION_LANGUAGE" ON "en_short_translations"  ("language") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_SHORT_TRANSLATION_WORD" ON "en_short_translations"  ("word") `,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_words_word_level_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_words_word_level_enum" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_words_area_variant_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_words_area_variant_enum" AS ENUM('common', 'british', 'american', 'australian')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_words_categories_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_words_categories_enum" AS ENUM('scientific', 'technical', 'medical', 'legal', 'business', 'IT', 'art', 'political', 'sport', 'culinary')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_words_language_register_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_words_language_register_enum" AS ENUM('formal', 'informal', 'slang')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_words_part_of_speech_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_words_part_of_speech_enum" AS ENUM('noun', 'verb', 'modal_verb', 'adjective', 'adverb', 'pronoun', 'numeral', 'numeral_fractional', 'determiner', 'interjection', 'article', 'preposition', 'conjunction', 'letter', 'phrase', 'grammar_pattern')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_words_form_of_word_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_words_form_of_word_enum" AS ENUM('base_form', 'plural_form', 'possessive_singular_form', 'possessive_plural_form', 'past_simple', 'past_participle', 'present_participle', 'third_person_singular', 'comparative_form', 'superlative_form', 'object', 'possessive_adjective', 'possessive_pronoun', 'reflexive', 'ordinal', 'multiplicative')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_words_verb___transitivity_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_words_verb___transitivity_enum" AS ENUM('transitive', 'intransitive', 'both')`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_words_verb___phrasal_object_pattern_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_words_verb___phrasal_object_pattern_enum" AS ENUM('no_object', 'inseparable', 'separable', 'separable_pronoun_only')`,
    );
    await queryRunner.query(
      `CREATE TABLE "en_words" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updateAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "generated" boolean NOT NULL DEFAULT true, "generated_by_model" text, "is_obsolete" boolean NOT NULL DEFAULT false, "is_abbreviation" boolean NOT NULL DEFAULT false, "word_level" "public"."en_words_word_level_enum", "area_variant" "public"."en_words_area_variant_enum", "categories" "public"."en_words_categories_enum" array NOT NULL DEFAULT '{}', "language_register" "public"."en_words_language_register_enum", "part_of_speech" "public"."en_words_part_of_speech_enum" NOT NULL, "form_of_word" "public"."en_words_form_of_word_enum" NOT NULL, "description" text, "transcription" text, "pattern" text, "noun___irregular_plural" boolean, "noun___uncountable" boolean, "noun___is_proper" boolean, "noun___always_plural" boolean, "verb___is_irregular" boolean, "verb___transitivity" "public"."en_words_verb___transitivity_enum", "verb___is_phrasal" boolean, "verb___phrasal_object_pattern" "public"."en_words_verb___phrasal_object_pattern_enum", "version" text NOT NULL DEFAULT '0.0.1', "word" character varying(128), "baseFormId" integer, "basePhrasalId" integer, CONSTRAINT "PK_7d122014ceeef2be6786c43bd6c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_EN_PART_OF_SPEECH" ON "en_words"  ("part_of_speech") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_PHRASAL_SEARCH" ON "en_words"  ("basePhrasalId", "part_of_speech", "form_of_word") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_EN_BASE_PHRASAL" ON "en_words"  ("basePhrasalId") `);
    await queryRunner.query(`CREATE INDEX "IDX_EN_BASE_FORM" ON "en_words"  ("baseFormId") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_EN_WORD_LOOKUP" ON "en_words"  ("word", "part_of_speech", "form_of_word") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_EN_WORD" ON "en_words"  ("word") `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."en_entries_type_enum"`);
    await queryRunner.query(
      `CREATE TYPE "public"."en_entries_type_enum" AS ENUM('word', 'grammar_pattern', 'phrase')`,
    );
    await queryRunner.query(
      `CREATE TABLE "en_entries" ("createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updateAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "word" character varying(128) NOT NULL, "type" "public"."en_entries_type_enum" NOT NULL DEFAULT 'word', CONSTRAINT "PK_eaf2f18de8dcf03db185829bec4" PRIMARY KEY ("word"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_EN_ENTRY_TYPE" ON "en_entries"  ("type") `);
    await queryRunner.query(
      `CREATE TABLE "settings" ("field" character varying(128) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updateAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "value" text NOT NULL, CONSTRAINT "PK_48b41fd97ac34cadbdb1507c54d" PRIMARY KEY ("field"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_meanings_translations" ADD CONSTRAINT "FK_362c14914d7cc5975ec0064f713" FOREIGN KEY ("meaning") REFERENCES "en_meanings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_meanings" ADD CONSTRAINT "FK_c9500c114ef90e741d1f8a70bc7" FOREIGN KEY ("word") REFERENCES "en_words"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_short_translations" ADD CONSTRAINT "FK_15a283db56bfbf9e5e74888f835" FOREIGN KEY ("word") REFERENCES "en_words"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_words" ADD CONSTRAINT "FK_5e501d01db67f687a5d2c3c9f7e" FOREIGN KEY ("word") REFERENCES "en_entries"("word") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_words" ADD CONSTRAINT "FK_d2961f038d05b043ec4feb8ee8c" FOREIGN KEY ("baseFormId") REFERENCES "en_words"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "en_words" ADD CONSTRAINT "FK_a7e76da6a07244481bb0b0c8627" FOREIGN KEY ("basePhrasalId") REFERENCES "en_words"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "en_words" DROP CONSTRAINT "FK_a7e76da6a07244481bb0b0c8627"`);
    await queryRunner.query(`ALTER TABLE "en_words" DROP CONSTRAINT "FK_d2961f038d05b043ec4feb8ee8c"`);
    await queryRunner.query(`ALTER TABLE "en_words" DROP CONSTRAINT "FK_5e501d01db67f687a5d2c3c9f7e"`);
    await queryRunner.query(
      `ALTER TABLE "en_short_translations" DROP CONSTRAINT "FK_15a283db56bfbf9e5e74888f835"`,
    );
    await queryRunner.query(`ALTER TABLE "en_meanings" DROP CONSTRAINT "FK_c9500c114ef90e741d1f8a70bc7"`);
    await queryRunner.query(
      `ALTER TABLE "en_meanings_translations" DROP CONSTRAINT "FK_362c14914d7cc5975ec0064f713"`,
    );
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_ENTRY_TYPE"`);
    await queryRunner.query(`DROP TABLE "en_entries"`);
    await queryRunner.query(`DROP TYPE "public"."en_entries_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_WORD"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_WORD_LOOKUP"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_BASE_FORM"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_BASE_PHRASAL"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_PHRASAL_SEARCH"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_PART_OF_SPEECH"`);
    await queryRunner.query(`DROP TABLE "en_words"`);
    await queryRunner.query(`DROP TYPE "public"."en_words_verb___phrasal_object_pattern_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_words_verb___transitivity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_words_form_of_word_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_words_part_of_speech_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_words_language_register_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_words_categories_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_words_area_variant_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_words_word_level_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_SHORT_TRANSLATION_WORD"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_SHORT_TRANSLATION_LANGUAGE"`);
    await queryRunner.query(`DROP TABLE "en_short_translations"`);
    await queryRunner.query(`DROP TYPE "public"."en_short_translations_language_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_MEANING_WORD"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_MEANING_WORD_SORT"`);
    await queryRunner.query(`DROP TABLE "en_meanings"`);
    await queryRunner.query(`DROP TYPE "public"."en_meanings_language_register_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_meanings_area_variant_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_meanings_meaning_level_enum"`);
    await queryRunner.query(`DROP TYPE "public"."en_meanings_categories_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_MEANING_TRANSLATION_MEANING"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_EN_MEANING_TRANSLATION_LANGUAGE"`);
    await queryRunner.query(`DROP TABLE "en_meanings_translations"`);
    await queryRunner.query(`DROP TYPE "public"."en_meanings_translations_language_enum"`);
  }
}
