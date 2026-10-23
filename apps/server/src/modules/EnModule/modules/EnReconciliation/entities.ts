import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  ReconciliationCategoryT,
  ReconciliationComparisonT,
  ReconciliationDecisionT,
  ReconciliationKindT,
  ReconciliationSideT,
  ReconciliationStatusT,
  ReconciliationValueT,
} from '../../../../../types/reconciliation';

@Entity('reconciliation_identity')
export class ReconciliationIdentity {
  /** Causal parents of the next local snapshot, never pending incoming revisions. */
  @Column({ type: 'simple-json', default: '[]' })
  heads!: string[];

  @PrimaryColumn({ type: 'varchar', length: 8 })
  key!: string;
  @Column({ type: 'varchar', length: 64 })
  lineage!: string;
}

/** Portable, per-dataset synchronization metadata. No FK to disposable content rows. */
@Entity('reconciliation_revisions')
export class ReconciliationRevision {
  @Column({ type: 'simple-json', default: '[]' })
  parents!: string[];

  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  lineage!: string;

  @Column({ type: 'simple-json' })
  metadata!: Record<string, ReconciliationValueT>;

  @Column({ type: 'boolean' })
  complete!: boolean;

  @Column({ type: 'boolean', default: false })
  sealed!: boolean;
}

@Entity('reconciliation_records')
export class ReconciliationRecord {
  @Column({ type: 'simple-json', default: '{}' })
  versions!: Record<string, string>;

  @Column({ type: 'simple-json', default: '[]' })
  history!: import('../../../../../types/dictionaries/en/EnDataSetTypes').DataSetChangeT[];

  @PrimaryColumn({ type: 'varchar', length: 64 })
  revision!: string;

  @PrimaryColumn({ type: 'varchar', length: 128 })
  headword!: string;

  @Column({ type: 'simple-json', nullable: true })
  content!: ReconciliationValueT;

  @Column({ type: 'varchar', length: 64 })
  hash!: string;
}

/** Last incoming state accepted from this lineage, not the resulting local state. */
@Entity('reconciliation_baselines')
export class ReconciliationBaseline {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  lineage!: string;

  @Column({ type: 'varchar', length: 64 })
  revision!: string;
}

@Entity('reconciliation_plans')
export class ReconciliationPlan {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: ReconciliationKindT;

  @Column({ type: 'varchar', length: 16 })
  status!: ReconciliationStatusT;

  @Column({ type: 'varchar', length: 64 })
  lineage!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  baseline!: string | null;

  @Column({ type: 'varchar', length: 64 })
  local!: string;

  @Column({ type: 'varchar', length: 64 })
  incoming!: string;

  @Column({ type: 'varchar', length: 32 })
  created_at!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  applied_at!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  outcome!: { added: number; deleted: number; changed: number } | null;
}

@Entity('reconciliation_items')
@Index('IDX_RECONCILIATION_ITEMS_CATEGORY', ['plan', 'category', 'headword'])
export class ReconciliationItem {
  /** Change relative to the pinned local content, recalculated with each decision. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  effect!: 'added' | 'deleted' | 'changed' | null;

  @PrimaryColumn({ type: 'varchar', length: 36 })
  plan!: string;

  @PrimaryColumn({ type: 'varchar', length: 128 })
  headword!: string;

  @Column({ type: 'varchar', length: 16 })
  category!: ReconciliationCategoryT;

  @Column({ type: 'simple-json' })
  comparison!: ReconciliationComparisonT;

  @Column({ type: 'simple-json' })
  decisions!: ReconciliationDecisionT[];

  @Column({ type: 'simple-json' })
  result!: ReconciliationSideT;

  @Column({ type: 'int' })
  remaining!: number;

  /** Optimistic concurrency for two review tabs editing the same item. */
  @Column({ type: 'int', default: 0 })
  version!: number;
}

/** Derived incoming data retained until a reviewed import is applied. Never exported as history. */
@Entity('reconciliation_embeddings')
export class ReconciliationEmbedding {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  plan!: string;
  @PrimaryColumn({ type: 'varchar', length: 64 })
  profile_id!: string;
  @PrimaryColumn({ type: 'integer' })
  ordinal!: number;
  @Column({ type: 'simple-json' })
  payload!: {
    profile: import('../../../../../types/embeddings').EmbeddingProfileT & { id: string };
    line: import('../../../../../types/embeddings').MeaningEmbeddingLineT;
  };
}

export const RECONCILIATION_ENTITIES = [
  ReconciliationEmbedding,
  ReconciliationIdentity,
  ReconciliationRevision,
  ReconciliationRecord,
  ReconciliationBaseline,
  ReconciliationPlan,
  ReconciliationItem,
];
