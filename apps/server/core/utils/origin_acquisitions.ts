import type { OriginAcquisitionT, OriginT } from '../../types/provenance';

// Compare complete source snapshots. Explicit keys make the comparison independent
// of the property order PostgreSQL JSONB returns.
export const originSnapshotKey = (origin: OriginT): string =>
  JSON.stringify({
    name: origin.name,
    version: origin.version,
    url: origin.url,
    record_url: origin.record_url,
    licenses: origin.licenses.map(({ spdx, name, url, text }) => ({ spdx, name, url, text })),
    license_relation: origin.license_relation,
    attribution: origin.attribution,
    notices: origin.notices,
    scope: origin.scope,
    recorded_at: origin.recorded_at,
  });

/** Inherit the source once and attach how it was acquired, without repeating its terms. */
export const inheritOrigin = (
  previous: readonly OriginT[],
  source: OriginT,
  acquisition: OriginAcquisitionT,
  includeNewTerms = true,
): { origins: OriginT[]; origin: OriginT } => {
  const origins = previous.map((item) => ({ ...item, inherited: true }));
  const key = originSnapshotKey(source);
  const index = origins.findIndex((item) => item.method === 'dataset' && originSnapshotKey(item) === key);
  const original = index < 0 ? source : origins[index];
  const origin = {
    ...original,
    inherited: true,
    acquisitions: [...(original.acquisitions ?? []), acquisition],
  };
  // An own dataset contributes terms through its actual edits. Passing through
  // an unchanged fork must not attach that fork's contribution license to the word.
  if (index < 0 && includeNewTerms) origins.push(origin);
  else if (index >= 0) origins[index] = origin;
  else if (origins.length) {
    // Keep the transfer even when the intermediate dataset has no new
    // contribution terms. One existing source carries the event for this word.
    const carrier = origins[0];
    origins[0] = {
      ...carrier,
      acquisitions: [
        ...(carrier.acquisitions ?? []),
        {
          ...acquisition,
          via: { name: source.name, version: source.version, ...(source.url && { url: source.url }) },
        },
      ],
    };
  }
  return { origins, origin };
};
