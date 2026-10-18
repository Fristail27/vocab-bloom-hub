/** Portable values used by the update/merge editor. Missing and null are distinct. */
export type ReconciliationValueT =
  null | boolean | number | string | ReconciliationArrayT | ReconciliationObjectT;

// Interfaces keep ORM mapped types lazy for recursive JSON documents.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ReconciliationArrayT extends Array<ReconciliationValueT> {}
export interface ReconciliationObjectT {
  [key: string]: ReconciliationValueT;
}

export type ReconciliationSideT = { present: false } | { present: true; value: ReconciliationValueT };

export type ReconciliationConflictT = {
  /** Segments, not a dotted string: field names and record identities may contain punctuation. */
  path: string[];
  baseline: ReconciliationSideT;
  local: ReconciliationSideT;
  incoming: ReconciliationSideT;
  kind: 'edit' | 'add' | 'delete' | 'baseline_missing' | 'dependency' | 'identity';
  targets?: string[];
};

export type ReconciliationDecisionT = {
  path: string[];
  choice: 'local' | 'incoming' | 'custom';
  /** Required only for custom. A missing value explicitly chooses deletion. */
  result?: ReconciliationSideT;
};

export type ReconciliationCategoryT =
  'added' | 'deleted' | 'changed' | 'conflicts' | 'local_only' | 'unchanged';

export type ReconciliationComparisonT = {
  result: ReconciliationSideT;
  conflicts: ReconciliationConflictT[];
  category: ReconciliationCategoryT;
};

export type ReconciliationCountsT = Record<ReconciliationCategoryT, number>;

export type ReconciliationKindT = 'source' | 'parent' | 'merge';
export type ReconciliationStatusT = 'preparing' | 'review' | 'applied' | 'cancelled' | 'failed';

export type ReconciliationPreparationStageT =
  | 'starting'
  | 'local_snapshot'
  | 'incoming_snapshot'
  | 'ancestry'
  | 'baseline'
  | 'comparing'
  | 'dependencies'
  | 'finalizing';

/** Live progress of the latest parent/related merge preparation on this server. */
export type ReconciliationPreparationT = {
  id: string;
  source: string;
  state: 'running' | 'completed' | 'failed';
  stage: ReconciliationPreparationStageT;
  processed: number;
  /** Only present when the exact number of records in this stage is known. */
  total?: number;
  started_at: string;
  finished_at?: string;
  plan_id?: string;
  failure?: string;
};

export type ReconciliationApplicationStageT =
  | 'waiting'
  | 'locking'
  | 'snapshot'
  | 'checking'
  | 'validating'
  | 'origins'
  | 'publishing'
  | 'history'
  | 'versions'
  | 'baseline'
  | 'finalizing';

/** Progress is complete only after the publication transaction commits and readers resume. */
export type ReconciliationApplicationT = {
  id: string;
  plan_id: string;
  state: 'running' | 'completed' | 'failed';
  stage: ReconciliationApplicationStageT;
  processed: number;
  total?: number;
  started_at: string;
  finished_at?: string;
  failure?: string;
};

export type ReconciliationSummaryT = {
  id: string;
  kind: ReconciliationKindT;
  status: ReconciliationStatusT;
  source: string;
  incoming_revision: string;
  incoming_complete?: boolean;
  baseline_available?: boolean;
  created_at: string;
  counts: ReconciliationCountsT;
  resolved_articles: number;
  remaining_conflicts: number;
  proposed: { added: number; deleted: number; changed: number };
};

export type ReconciliationItemT = {
  baseline?: ReconciliationSideT;
  local?: ReconciliationSideT;
  incoming?: ReconciliationSideT;
  plan: string;
  headword: string;
  category: ReconciliationCategoryT;
  comparison: ReconciliationComparisonT;
  decisions: ReconciliationDecisionT[];
  result: ReconciliationSideT;
  remaining: number;
  version: number;
};

export type ReconciliationIndexT = {
  plans: { id: string; kind: ReconciliationKindT; status: ReconciliationStatusT; created_at: string }[];
  sources?: { name: string; title: string }[];
  parents: { lineage: string; source: string; revision: string }[];
};
