import { createHash } from 'node:crypto';
import type {
  ReconciliationComparisonT,
  ReconciliationConflictT,
  ReconciliationDecisionT,
  ReconciliationSideT,
  ReconciliationValueT,
} from '../../../../../types/reconciliation';

export const missing: ReconciliationSideT = { present: false };
export const present = (value: ReconciliationValueT): ReconciliationSideT => ({ present: true, value });

export function validSide(side: unknown): side is ReconciliationSideT {
  let nodes = 0;
  const json = (value: unknown, depth: number): boolean => {
    if (++nodes > 100000 || depth > 32) return false;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every((item) => json(item, depth + 1));
    if (value && typeof value === 'object') return Object.values(value).every((item) => json(item, depth + 1));
    return false;
  };
  if (!side || typeof side !== 'object' || Array.isArray(side)) return false;
  const candidate = side as ReconciliationSideT;
  if (candidate.present === false) return Object.keys(candidate).length === 1;
  return candidate.present === true && Object.keys(candidate).length === 2 && json(candidate.value, 0);
}

/** Stable across JSON storage engines; array ordering remains significant. */
export const canonicalValue = (value: ReconciliationValueT): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const contentHash = (value: ReconciliationValueT): string =>
  createHash('sha256').update(canonicalValue(value)).digest('hex');

export const equalSides = (a: ReconciliationSideT, b: ReconciliationSideT): boolean =>
  a.present === b.present && (!a.present || (b.present && canonicalValue(a.value) === canonicalValue(b.value)));

const objectOf = (side: ReconciliationSideT): Record<string, ReconciliationValueT> | null =>
  side.present && side.value !== null && typeof side.value === 'object' && !Array.isArray(side.value)
    ? side.value
    : null;

const child = (object: Record<string, ReconciliationValueT>, key: string): ReconciliationSideT =>
  Object.hasOwn(object, key) ? present(object[key]) : missing;

/**
 * Collections of records are keyed by durable identity before comparison. Arrays are
 * ordered values: merging them by index would silently pair different senses/translations.
 * A source without reliable identity must retain an ambiguous collection as one conflict.
 */
export const compare = (
  baseline: ReconciliationSideT,
  local: ReconciliationSideT,
  incoming: ReconciliationSideT,
  options: { baselineKnown?: boolean; complete?: boolean } = {},
): ReconciliationComparisonT => {
  const conflicts: ReconciliationConflictT[] = [];
  // A missing article from a partial input is not an incoming deletion.
  if (options.complete === false && !incoming.present) {
    return { result: local, conflicts, category: equalSides(baseline, local) ? 'unchanged' : 'local_only' };
  }
  const visit = (
    base: ReconciliationSideT,
    ours: ReconciliationSideT,
    theirs: ReconciliationSideT,
    path: string[],
  ): ReconciliationSideT => {
    if (options.complete === false && !theirs.present) return ours;
    if (equalSides(ours, theirs)) return ours;
    const baseCollection = objectOf(base);
    const incomingCollection = objectOf(theirs);
    if (baseCollection && incomingCollection) {
      const oldKeys = Object.keys(baseCollection);
      const newKeys = Object.keys(incomingCollection);
      const identity = (key: string) => /^[\da-f]{8}-[\da-f-]{27}$/i.test(key);
      if (
        oldKeys.length &&
        newKeys.length &&
        oldKeys.every(identity) &&
        newKeys.every(identity) &&
        oldKeys.some((key) => !Object.hasOwn(incomingCollection, key)) &&
        newKeys.some((key) => !Object.hasOwn(baseCollection, key))
      ) {
        conflicts.push({ path, baseline: base, local: ours, incoming: theirs, kind: 'identity' });
        return ours;
      }
    }
    if (options.baselineKnown !== false) {
      if (equalSides(base, ours) && !(objectOf(ours) && objectOf(theirs))) return theirs;
      if (equalSides(base, theirs)) return ours;
    }
    const b = objectOf(base);
    const l = objectOf(ours);
    const r = objectOf(theirs);
    // Concurrent additions of one identity are a conflict as a whole. Combining
    // their different required fields could manufacture a record neither side made.
    if (l && r && (b || options.baselineKnown === false)) {
      const result: Record<string, ReconciliationValueT> = Object.create(null);
      for (const key of [...new Set([...Object.keys(b ?? {}), ...Object.keys(l), ...Object.keys(r)])].sort()) {
        const value = visit(b ? child(b, key) : missing, child(l, key), child(r, key), [...path, key]);
        if (value.present) result[key] = value.value;
      }
      return present(result);
    }
    conflicts.push({
      path,
      baseline: base,
      local: ours,
      incoming: theirs,
      kind:
        options.baselineKnown === false
          ? 'baseline_missing'
          : !base.present
            ? 'add'
            : !ours.present || !theirs.present
              ? 'delete'
              : 'edit',
    });
    return ours;
  };
  const result = visit(baseline, local, incoming, []);
  const category = conflicts.length
    ? 'conflicts'
    : equalSides(result, local)
      ? equalSides(baseline, local)
        ? 'unchanged'
        : 'local_only'
      : !local.present
        ? 'added'
        : !result.present
          ? 'deleted'
          : 'changed';
  return { result, conflicts, category };
};

/** Decisions address only conflicts in this exact comparison, never arbitrary fields. */
export const resolve = (
  comparison: ReconciliationComparisonT,
  decisions: ReconciliationDecisionT[],
): { result: ReconciliationSideT; remaining: number } => {
  let result = structuredClone(comparison.result);
  const conflicts = new Map(comparison.conflicts.map((conflict) => [JSON.stringify(conflict.path), conflict]));
  const seen = new Set<string>();
  for (const decision of decisions) {
    const key = JSON.stringify(decision.path);
    const conflict = conflicts.get(key);
    if (!conflict || seen.has(key)) throw new Error('reconciliation_decision_outdated');
    seen.add(key);
    let chosen: ReconciliationSideT;
    if (decision.choice === 'local') chosen = conflict.local;
    else if (decision.choice === 'incoming') chosen = conflict.incoming;
    else if (decision.choice === 'custom' && validSide(decision.result)) chosen = decision.result;
    else throw new Error('reconciliation_decision_invalid');
    chosen = structuredClone(chosen);
    if (decision.path.length === 0) {
      result = chosen;
      continue;
    }
    let parent = objectOf(result);
    for (const segment of decision.path.slice(0, -1)) {
      if (!parent || !Object.hasOwn(parent, segment)) throw new Error('reconciliation_decision_outdated');
      parent = objectOf(present(parent[segment]));
    }
    if (!parent) throw new Error('reconciliation_decision_outdated');
    const field = decision.path[decision.path.length - 1];
    // defineProperty avoids the legacy __proto__ setter when applying an imported key.
    if (chosen.present)
      Object.defineProperty(parent, field, {
        value: chosen.value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    else delete parent[field];
  }
  return { result, remaining: conflicts.size - seen.size };
};

/** Selecting existing values can change arrangement without creating new licensed text. */
export function isSelection(result: ReconciliationSideT, sources: ReconciliationSideT[]): boolean {
  if (!result.present || sources.some((source) => equalSides(result, source))) return true;
  const object = objectOf(result);
  if (object)
    return Object.entries(object).every(([key, value]) =>
      isSelection(
        present(value),
        sources.map((source) => {
          const candidate = objectOf(source);
          return candidate ? child(candidate, key) : missing;
        }),
      ),
    );
  if (Array.isArray(result.value))
    return result.value.every((value) =>
      isSelection(
        present(value),
        sources.flatMap((source) =>
          source.present && Array.isArray(source.value) ? source.value.map(present) : [],
        ),
      ),
    );
  return false;
}
