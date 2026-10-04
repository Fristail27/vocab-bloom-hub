import type { WordLicenseT, OriginT } from '../../types/provenance';
import { findStandardLicense } from '../constants/data_licenses';
import { findCatalogEntry, noticesText } from '../constants/dataset_catalog';

export type ProvenanceDatasetT = {
  name: string;
  source: string;
  own?: boolean;
  title?: string | null;
  version?: string | null;
  license: string;
  license_url: string;
  license_text?: string | null;
  attribution: string;
  attribution_url?: string | null;
  notice?: string | null;
  origins?: OriginT[] | null;
};

/** A legacy row gets only facts we know; its acquisition date is unknown. */
export const datasetOrigin = (dataset: ProvenanceDatasetT): OriginT => {
  const catalog = dataset.own ? undefined : findCatalogEntry(dataset.name);
  const wordNotices = catalog?.notices.filter((notice) => notice.scope !== 'dataset') ?? [];
  const standard = findStandardLicense(dataset.license);
  const text = dataset.license_text || (catalog ? noticesText({ ...catalog, notices: wordNotices }) : '');
  return {
    id: `dataset:${dataset.source}:${dataset.version ?? 'unknown'}`,
    name: dataset.title || catalog?.title || dataset.name,
    version: dataset.version ?? null,
    ...(dataset.attribution_url && { url: dataset.attribution_url }),
    licenses: [
      {
        ...(standard && { spdx: standard.spdx }),
        name: standard?.name || dataset.license,
        url: dataset.license_url,
        ...(text && { text }),
      },
    ],
    license_relation: 'all',
    attribution: dataset.attribution,
    notices: [dataset.notice, ...wordNotices.map((notice) => notice.text)].filter((notice): notice is string =>
      Boolean(notice),
    ),
    scope: 'word',
    method: 'dataset',
    recorded_at: null,
    inherited: true,
  };
};

/** Explicit word origins replace dataset defaults, never union unrelated sources. */
export const defaultOrigins = (dataset: ProvenanceDatasetT): OriginT[] => [
  datasetOrigin(dataset),
  ...(dataset.origins ?? [])
    .filter((origin) => origin.scope === 'dataset')
    .map((origin) => ({ ...origin, inherited: true })),
];

export const licensesOf = (origins: readonly OriginT[]): WordLicenseT[] =>
  origins.flatMap((origin) => origin.licenses.map((license) => ({ ...license, origin_id: origin.id })));

/** A narrow compatibility rule, not a claim to verify arbitrary licensing terms. */
export const incompatibleShareAlike = (origins: readonly OriginT[], contributionLicense: string): boolean =>
  origins.some((origin) => {
    const compatible = (license: OriginT['licenses'][number]): boolean =>
      !findStandardLicense(license.spdx ?? '')?.share_alike || contributionLicense === license.spdx;
    return origin.license_relation === 'any'
      ? !origin.licenses.some(compatible)
      : !origin.licenses.every(compatible);
  });
