import { MigrationInterface, QueryRunner } from 'typeorm';

// The audit journal of admin changes (issue #334): operational data of the
// instance, outside the dictionary export and the public API. createdAt is
// the listing order and the retention cutoff; (entity_type, entity_id) backs
// the per-entity filters.
export class AddAuditLog1788500000000 implements MigrationInterface {
  name = 'AddAuditLog1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_log" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "trigger" character varying(16) NOT NULL,
        "action" character varying(16) NOT NULL,
        "entity_type" character varying(32) NOT NULL,
        "entity_id" integer,
        "headword" character varying(512),
        "diff" jsonb,
        "request_id" character varying(128),
        CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_AUDIT_CREATED_AT" ON "audit_log" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_AUDIT_ENTITY" ON "audit_log" ("entity_type", "entity_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_AUDIT_ENTITY"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_AUDIT_CREATED_AT"`);
    await queryRunner.query(`DROP TABLE "audit_log"`);
  }
}
