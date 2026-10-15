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
