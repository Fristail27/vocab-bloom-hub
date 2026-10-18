import { delay, http, HttpResponse } from 'msw';
import type {
  ReconciliationApplicationT,
  ReconciliationDecisionT,
  ReconciliationItemT,
  ReconciliationPreparationT,
  ReconciliationSideT,
  ReconciliationSummaryT,
  ReconciliationObjectT,
} from 'server/types/reconciliation';
import { automaticItems, conflictItem, DATE, PLAN_ID } from './fixtures';

export type ReviewScenario = {
  kind?: ReconciliationSummaryT['kind'];
  source?: string;
  conflict?: Parameters<typeof conflictItem>[0];
  noConflicts?: boolean;
  many?: boolean;
  baselineMissing?: boolean;
  partial?: boolean;
  status?: ReconciliationSummaryT['status'];
  preparation?: 'running' | 'failed';
  application?: 'running' | 'failed';
  saveError?: boolean;
  stale?: boolean;
};

export const API = '/__storybook/api/en/datasets';
export const failure = (message: string, status = 409) =>
  HttpResponse.json({ error: true, message }, { status });

/** A contract fixture, not a second implementation of the server's three-way merge. */
export function reconciliationHandlers(options: ReviewScenario = {}) {
  const conflict = conflictItem(options.conflict);
  const automatic = automaticItems();
  if (options.baselineMissing) {
    conflict.baseline = undefined;
    for (const field of conflict.comparison.conflicts) {
      field.baseline = { present: false };
      field.kind = 'baseline_missing';
    }
  }
  if (options.partial) {
    // An omitted article in a partial source is kept, never inferred to be deleted.
    const omitted = automatic.find((item) => item.category === 'deleted')!;
    omitted.category = 'unchanged';
    omitted.result = omitted.local!;
    omitted.comparison = { category: 'unchanged', result: omitted.result, conflicts: [] };
  }
  const items = options.baselineMissing
    ? [conflict]
    : options.noConflicts
      ? automatic
      : [conflict, ...automatic];
  if (options.many) {
    for (let index = 1; index <= 30; index++)
      items.push({ ...conflictItem(), headword: `sample-${String(index).padStart(2, '0')}` });
  }
  const summary: ReconciliationSummaryT = {
    id: PLAN_ID,
    kind: options.kind ?? 'parent',
    status: options.status ?? 'review',
    source: options.source ?? 'opengloss',
    incoming_revision: 'fixture-revision',
    created_at: DATE,
    baseline_available: !options.baselineMissing,
    incoming_complete: !options.partial,
    counts: { added: 0, deleted: 0, changed: 0, conflicts: 0, local_only: 0, unchanged: 0 },
    remaining_conflicts: 0,
    resolved_articles: 0,
    proposed: { added: 1, deleted: 1, changed: 2 },
  };
  let preparation: ReconciliationPreparationT | null = options.preparation
    ? {
        id: 'prepare-fixture',
        source: 'opengloss',
        state: options.preparation,
        stage: 'comparing',
        processed: 12500,
        total: 20000,
        started_at: new Date().toISOString(),
        ...(options.preparation === 'failed' && { failure: 'reconciliation_baseline_required' }),
      }
    : null;
  let application: ReconciliationApplicationT | null = options.application
    ? {
        id: 'apply-fixture',
        plan_id: PLAN_ID,
        state: options.application,
        stage: 'history',
        processed: 6700,
        total: 10000,
        started_at: new Date().toISOString(),
        ...(options.application === 'failed' && { failure: 'reconciliation_stale' }),
      }
    : null;
  let preparePolls = 0;
  let applyPolls = 0;
  let failSave = options.saveError;
  const refreshSummary = () => {
    for (const key of Object.keys(summary.counts) as (keyof typeof summary.counts)[]) {
      summary.counts[key] = items.filter((item) => item.category === key).length;
    }
    summary.remaining_conflicts = items.reduce((sum, item) => sum + item.remaining, 0);
    summary.resolved_articles = items.filter((item) => item.category === 'conflicts' && !item.remaining).length;
    summary.proposed = { added: 0, deleted: 0, changed: 0 };
    for (const item of items) {
      if (JSON.stringify(item.result) === JSON.stringify(item.local)) continue;
      summary.proposed[!item.local?.present ? 'added' : !item.result.present ? 'deleted' : 'changed']++;
    }
    return summary;
  };
  const save = async (request: Request, whole = false) => {
    await delay(180);
    if (failSave) {
      failSave = false;
      return failure('unknown_error', 500);
    }
    const body = (await request.json()) as {
      headword: string;
      version: number;
      decisions?: ReconciliationDecisionT[];
      result?: ReconciliationSideT;
    };
    const item = items.find((row) => row.headword === body.headword);
    if (!item) return failure('not_found', 404);
    if (body.version !== item.version) return failure('reconciliation_outdated');
    if (whole && body.result) {
      item.result = body.result;
      item.remaining = 0;
      item.comparison = {
        category: item.category,
        result: item.result,
        conflicts: [
          {
            path: [],
            kind: 'edit',
            baseline: item.baseline ?? { present: false },
            local: item.local ?? { present: false },
            incoming: item.incoming ?? { present: false },
          },
        ],
      };
      item.decisions = [{ path: [], choice: 'custom', result: body.result }];
    } else {
      item.decisions = body.decisions ?? [];
      item.remaining = item.comparison.conflicts.filter(
        (conflict) =>
          !item.decisions.some((decision) => JSON.stringify(decision.path) === JSON.stringify(conflict.path)),
      ).length;
      item.result = structuredClone(item.comparison.result);
      for (const decision of item.decisions) {
        const conflict = item.comparison.conflicts.find(
          (row) => JSON.stringify(row.path) === JSON.stringify(decision.path),
        );
        if (!conflict) continue;
        const side = decision.choice === 'custom' ? decision.result : conflict[decision.choice];
        if (side) setResult(item, decision.path, side);
      }
    }
    item.version++;
    return HttpResponse.json(item);
  };
  const base = `${API}/:dataset/reconciliation`;
  return [
    http.get(base, () =>
      HttpResponse.json({
        plans: [summary],
        parents: [{ lineage: 'fixture-lineage', source: 'opengloss', revision: '2.4' }],
        sources: [
          { name: 'opengloss', title: 'OpenGloss' },
          { name: 'wordnet', title: 'Open English WordNet' },
        ],
      }),
    ),
    http.get(`${base}/preparation`, () => {
      if (preparation?.state === 'running' && !options.preparation && ++preparePolls >= 3) {
        preparation = {
          ...preparation,
          state: 'completed',
          plan_id: PLAN_ID,
          finished_at: new Date().toISOString(),
        };
      }
      return HttpResponse.json({ preparation });
    }),
    http.get(`${base}/application`, () => {
      if (application?.state === 'running' && !options.application) {
        applyPolls++;
        if (applyPolls >= 4) {
          application = {
            ...application,
            state: 'completed',
            processed: 10000,
            finished_at: new Date().toISOString(),
          };
          summary.status = 'applied';
        } else {
          application = {
            ...application,
            stage: applyPolls < 2 ? 'checking' : 'history',
            processed: applyPolls * 2500,
            total: 10000,
          };
        }
      }
      return HttpResponse.json({ application });
    }),
    http.post(`${base}/parent/start`, async ({ request }) => {
      const body = (await request.json()) as { source: string; allow_two_way: boolean };
      if (options.baselineMissing && !body.allow_two_way) return failure('reconciliation_baseline_required');
      summary.kind = body.source === 'opengloss' ? 'parent' : 'merge';
      summary.source = body.source;
      summary.status = 'review';
      preparePolls = 0;
      preparation = {
        id: 'new-prepare-fixture',
        source: body.source,
        state: 'running',
        stage: 'comparing',
        processed: 12000,
        total: 20000,
        started_at: new Date().toISOString(),
      };
      return HttpResponse.json(preparation, { status: 202 });
    }),
    http.get(`${base}/:id`, () => HttpResponse.json(refreshSummary())),
    http.get(`${base}/:id/items`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const filtered = items.filter(
        (item) =>
          (!query.get('category') || item.category === query.get('category')) &&
          item.headword.includes(query.get('search') ?? ''),
      );
      const page = Number(query.get('page') ?? 1);
      return HttpResponse.json({ items: filtered.slice((page - 1) * 25, page * 25), total: filtered.length });
    }),
    http.post(`${base}/:id/decisions`, ({ request }) => save(request)),
    http.post(`${base}/:id/result`, ({ request }) => save(request, true)),
    http.post(`${base}/:id/cancel`, () => {
      summary.status = 'cancelled';
      return HttpResponse.json({ success: true });
    }),
    http.post(`${base}/:id/apply/start`, () => {
      if (options.stale) return failure('reconciliation_stale');
      if (refreshSummary().remaining_conflicts) return failure('reconciliation_unresolved');
      applyPolls = 0;
      application = {
        id: 'new-apply-fixture',
        plan_id: PLAN_ID,
        state: 'running',
        stage: 'waiting',
        processed: 0,
        started_at: new Date().toISOString(),
      };
      return HttpResponse.json(application, { status: 202 });
    }),
  ];
}

function setResult(item: ReconciliationItemT, path: string[], side: ReconciliationSideT) {
  if (!path.length) {
    item.result = structuredClone(side);
    return;
  }
  if (!item.result.present) return;
  let target = item.result.value as ReconciliationObjectT;
  for (const key of path.slice(0, -1)) {
    if (!target[key] || typeof target[key] !== 'object') target[key] = {};
    target = target[key] as ReconciliationObjectT;
  }
  const key = path.at(-1)!;
  if (side.present) target[key] = structuredClone(side.value);
  else delete target[key];
}
