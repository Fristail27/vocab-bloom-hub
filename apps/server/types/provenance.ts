/** A durable statement of terms, not a pointer to a mutable dataset registry. */
export type OriginLicenseT = {
  spdx?: string;
  name: string;
  url: string;
  /** Required for custom licenses; preserved verbatim when supplied. */
  text?: string;
};

/** An acquisition of a source snapshot, without repeating its license terms. */
export type OriginAcquisitionT = {
  id: string;
  method: 'copy' | 'fork';
  recorded_at: string | null;
  revision?: string;
  /** The intermediate dataset the material passed through; this adds no license obligations. */
  via?: { name: string; version: string | null; url?: string };
};

export type OriginT = {
  id: string;
  name: string;
  version: string | null;
  url?: string;
  record_url?: string;
  licenses: OriginLicenseT[];
  /** All obligations apply, or the source explicitly offers a choice. */
  license_relation: 'all' | 'any';
  attribution: string;
  notices: string[];
  /** Dataset means that distribution between individual words is unknown. */
  scope: 'word' | 'dataset';
  method: 'dataset' | 'manual';
  recorded_at: string | null;
  /** Copy/fork events belonging to this source snapshot; absent before any acquisition. */
  acquisitions?: OriginAcquisitionT[];
  /** Automatically inherited terms cannot be removed by ordinary editing. */
  inherited: boolean;
};

/** One license can occur more than once; origin_id refers to origins or contributions. */
export type WordLicenseT = OriginLicenseT & { origin_id: string };

export type ProvenanceT = {
  origins?: OriginT[];
  /** Dataset terms captured for edits that still contribute to this word. */
  contributions?: OriginT[];
  licenses?: WordLicenseT[];
};

export type UpdateOriginsReqT = { origins: OriginT[]; reason: string };

export type CopyWordSourceT = { dataset: string; id: number; revision: string };

export type ForkProgressT = {
  name: string;
  parent: string;
  state: 'copying' | 'completed' | 'failed';
  completed_tables: number;
  total_tables: number;
  failure?: string;
};

/** Terms kept in a portable export, alongside the legacy manifest fields. */
export type DatasetProvenanceSnapshotT = {
  attribution?: string;
  attribution_url?: string | null;
  license_url?: string;
  title: string | null;
  notice: string | null;
  origins: OriginT[];
  description: string | null;
  license_text: string | null;
};
