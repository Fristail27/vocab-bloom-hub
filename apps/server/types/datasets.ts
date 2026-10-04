import type { OriginT } from './provenance';
import { ErrorResT } from './errors';

/** Download the catalog's source files on the server; no caller-supplied URLs. */
export type DownloadDatasetReqT = {
  /** Include CMUdict when the catalog offers it as an optional file. */
  pronunciations?: boolean;
};

/**
 * A dictionary dataset an instance can hold (issue #527): an entry of the
 * catalog the code ships (core/constants/dataset_catalog.ts) with what the
 * instance knows about it — whether it is installed, which version, whether
 * it is the one being served. The terms of a dataset of the catalog are the
 * catalog's, never typed by an admin; a dataset of the instance's own (issue
 * #540) is created by the admin under the terms they state. On Postgres
 * every installed dataset has a schema of its own; on SQLite there is the
 * default one only.
 */
export type DatasetT = {
  description?: string | null;
  origins?: OriginT[];
  /** Lower-case identifier, `default` for the dataset the instance was born with */
  name: string;
  /** The name of the dataset for a reader */
  title: string;
  /** A dataset of the instance's own (issue #540): no catalog entry stands behind it, its terms are the owner's */
  own: boolean;
  /** Whether the instance holds it: a schema with its tables exists */
  installed: boolean;
  /** What the data is: `vocab-bloom-hub`, `wiktionary`, `wordnet`, … */
  source: string;
  /** The language of the headwords */
  language: string;
  /** The imported version or the version chosen by an own dataset's owner; null when unknown */
  version: string | null;
  /** SPDX identifier of the data license */
  license: string;
  license_url: string;
  /** The attribution line a consumer has to show */
  attribution: string;
  /** Where the attribution leads, when the source asks for a link */
  attribution_url: string | null;
  /** The provenance notice to pass on to readers (e.g. machine-generated data); null when none applies */
  notice: string | null;
  /** The text of a license of the owner's own, in full; null for a license named by its link */
  license_text: string | null;
  active: boolean;
  is_default: boolean;
  /** When the dataset was installed; null while it is not */
  created_at: string | null;
  imported_at: string | null;
};

export type DatasetsListT = {
  /** false on SQLite: one dataset, no creating, switching or deleting */
  supported: boolean;
  active: string;
  datasets: DatasetT[];
};

/** Where the data of a dataset comes from and under which terms */
export type DatasetProvenanceT = Pick<
  DatasetT,
  'source' | 'language' | 'license' | 'license_url' | 'attribution' | 'attribution_url' | 'notice'
>;

/**
 * The license a dataset of the instance's own comes under (issue #540): one
 * of the list (`core/constants/data_licenses.ts`) by its SPDX identifier, or
 * a license of the owner's own — its name, a link and its text in full
 */
export type DatasetLicenseReqT = {
  /** A license of the list; the other fields are left out */
  spdx?: string;
  /** A license of the owner's own: all three */
  name?: string;
  url?: string;
  text?: string;
};

/** POST /api/en/datasets: an empty dataset of the instance's own */
export type CreateDatasetReqT = {
  /** This dataset's version, independent of its sources; empty or null means unknown */
  version?: string | null;
  description?: string | null;
  notice?: string | null;
  origins?: OriginT[];
  name: string;
  title: string;
  license: DatasetLicenseReqT;
  attribution: string;
  attribution_url?: string | null;
};

/**
 * PATCH /api/en/datasets/{name}: the terms of a dataset of the owner's. The
 * title and the attribution are corrected freely; a new license is a
 * decision the admin UI asks to confirm, and the audit journal keeps
 */
export type UpdateDatasetReqT = Partial<Omit<CreateDatasetReqT, 'name'>>;

export type GetDatasetsResT = DatasetsListT | ErrorResT;
export type DatasetResT = DatasetT | ErrorResT;
export type DeleteDatasetResT = { success: true } | ErrorResT;

/**
 * What the source of an installed dataset has published (issue #530): the
 * admin UI says on the card of the dataset when a newer file exists. A
 * notice for the owner — the installation stays manual, and nothing of this
 * is a part of the public API.
 */
export type DatasetUpdateT = {
  name: string;
  /** The version the dataset is installed with; null when it holds nothing yet */
  installed: string | null;
  /** The version the newest file of the source would be installed with; null when the source could not be asked */
  latest: string | null;
  /** The page of the source the newer file is downloaded from */
  url: string | null;
  /**
   * Whether the installed version says which file of the source the dataset
   * holds. False for a dataset recorded by the day of its installation where
   * the source counts editions: it has to be installed again to know
   */
  comparable: boolean;
  /**
   * The source has a file that is worth installing: a newer edition, or an
   * extract that is a month newer than the installed one. False when the
   * two versions cannot be compared
   */
  update_available: boolean;
  checked_at: string | null;
};

export type DatasetUpdatesT = {
  /** false when `UPDATE_CHECK` is off: no source is asked */
  enabled: boolean;
  /** The installed datasets whose source can be asked, in the order of the catalog */
  datasets: DatasetUpdateT[];
};

export type GetDatasetUpdatesResT = DatasetUpdatesT | ErrorResT;
