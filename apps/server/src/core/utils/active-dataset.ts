import { DEFAULT_DATASET_NAME, OWN_DATASET_SOURCE } from '../../../core/constants/datasets';

// What the process serves right now (issue #527), for the places that need
// the name or the source of the active dataset and cannot depend on
// DatasetsService — the audit journal it writes into, the pure projections.
// DatasetsService sets it at start and on every switch.
type ActiveDatasetT = { name: string; source: string; own: boolean };

let active: ActiveDatasetT = { name: DEFAULT_DATASET_NAME, source: OWN_DATASET_SOURCE, own: false };

export const setActiveDataset = (dataset: { name: string; source: string; own?: boolean }): void => {
  active = { name: dataset.name, source: dataset.source, own: dataset.own === true };
};

/** The active dataset: its name, its source and whether the owner created it (issue #540) */
export const getActiveDataset = (): ActiveDatasetT => active;

export const getActiveDatasetName = (): string => active.name;
export const getActiveDatasetSource = (): string => active.source;
