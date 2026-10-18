import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RefineReconciliation1792100001000 implements MigrationInterface {
  name = 'RefineReconciliation1792100001000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "reconciliation_identity" ADD "heads" text NOT NULL DEFAULT '[]'`);
    await runner.query(`ALTER TABLE "reconciliation_revisions" ADD "parents" text NOT NULL DEFAULT '[]'`);
    await runner.query(`ALTER TABLE "reconciliation_items" ADD "effect" varchar(8)`);
    // The cached effect is content-only; JSONB equality ignores object key order.
    await runner.query(`UPDATE reconciliation_items i SET effect = CASE
      WHEN (CASE WHEN l.content IS NULL OR l.content::jsonb = 'null'::jsonb THEN '{"present":false}'::jsonb
            ELSE jsonb_build_object('present', true, 'value', l.content::jsonb) END) = i.result::jsonb THEN NULL
      WHEN l.content IS NULL OR l.content::jsonb = 'null'::jsonb THEN 'added'
      WHEN NOT (i.result::jsonb->>'present')::boolean THEN 'deleted' ELSE 'changed' END
      FROM reconciliation_plans p LEFT JOIN reconciliation_records l ON l.revision = p.local
      WHERE i.plan = p.id AND l.headword = i.headword`);
    await runner.query(`UPDATE reconciliation_items i SET effect = CASE WHEN (i.result::jsonb->>'present')::boolean THEN 'added' ELSE NULL END
      FROM reconciliation_plans p WHERE i.plan = p.id AND NOT EXISTS
      (SELECT 1 FROM reconciliation_records l WHERE l.revision = p.local AND l.headword = i.headword)`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "reconciliation_items" DROP "effect"');
    await runner.query('ALTER TABLE "reconciliation_revisions" DROP "parents"');
    await runner.query('ALTER TABLE "reconciliation_identity" DROP "heads"');
  }
}
