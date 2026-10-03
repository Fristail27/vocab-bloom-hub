import type { OriginT } from '../../types/provenance';
import { originSnapshotKey } from './origin_acquisitions';

/** Terms already stated by an original source need not be repeated as a contribution. */
export const contributionsOf = (origins: readonly OriginT[], candidates: readonly OriginT[]): OriginT[] => {
  const known = new Set(origins.filter((origin) => origin.method === 'dataset').map(originSnapshotKey));
  return candidates.filter((origin) => {
    const key = originSnapshotKey(origin);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
};
