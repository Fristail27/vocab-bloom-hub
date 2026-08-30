import { AuditDiffT } from '../../../types';

/**
 * Snapshots and diffs for the audit log (issue #334): pure, so the shape of
 * what lands in `diff` is unit-tested. A snapshot keeps the scalar state of
 * an entity — primitives, arrays of primitives, dates — and reduces related
 * entities to something readable (their `word` or `id`); functions and
 * anything unrecognisable are left out.
 */
export type SnapshotT = Record<string, unknown>;

const scalarOf = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.map(scalarOf).filter((item) => item !== undefined);
    return items.length === value.length ? items : undefined;
  }
  if (typeof value === 'object') {
    const related = value as { word?: unknown; id?: unknown };
    if (typeof related.word === 'string') return related.word;
    if (['number', 'string'].includes(typeof related.id)) return related.id;
  }
  return undefined;
};

export const snapshotScalars = (entity: object): SnapshotT => {
  const snapshot: SnapshotT = {};
  for (const [key, value] of Object.entries(entity)) {
    const scalar = scalarOf(value);
    if (scalar !== undefined) snapshot[key] = scalar;
  }
  return snapshot;
};

/** The fields whose value changed between two snapshots; null when nothing did */
export const diffSnapshots = (before: SnapshotT, after: SnapshotT): AuditDiffT | null => {
  const diff: AuditDiffT = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const prev = before[key] ?? null;
    const next = after[key] ?? null;
    if (JSON.stringify(prev) !== JSON.stringify(next)) diff[key] = { before: prev, after: next };
  }
  return Object.keys(diff).length > 0 ? diff : null;
};
