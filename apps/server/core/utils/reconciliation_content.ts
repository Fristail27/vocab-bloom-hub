import type { ReconciliationValueT } from '../../types/reconciliation';

const originsPath = (path: readonly string[]): boolean =>
  path.length === 4 && path[0] === 'parts' && path[2] === 'common' && path[3] === 'origins';

/** Acquisition bookkeeping is retained in snapshots, but is not an editorial change. */
export const isOriginMetadataField = (path: readonly string[], field: string): boolean =>
  path.length === 5 &&
  originsPath(path.slice(0, -1)) &&
  ['id', 'method', 'recorded_at', 'inherited', 'acquisitions'].includes(field);

/** A comparison-only projection. Never store this in place of a complete source snapshot. */
export function comparisonValue(
  value: ReconciliationValueT,
  path: readonly string[] = [],
): ReconciliationValueT {
  if (Array.isArray(value)) {
    const values = value.map((item, index) => comparisonValue(item, [...path, String(index)]));
    // Origins state a set of source terms; the order of their acquisition is not content.
    return originsPath(path)
      ? values.sort((a, b) => {
          const left = JSON.stringify(a);
          const right = JSON.stringify(b);
          return left < right ? -1 : left > right ? 1 : 0;
        })
      : values;
  }
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => !isOriginMetadataField(path, key))
        .map((key) => [key, comparisonValue(value[key], [...path, key])]),
    );
  return value;
}
