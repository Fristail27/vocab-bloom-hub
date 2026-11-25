import { AsyncLocalStorage } from 'node:async_hooks';
import type { Dataset } from '../../modules/DatasetsModule/entities/dataset.entity';
import { DEFAULT_DATASET_NAME, OWN_DATASET_SOURCE } from '../../../core/constants/datasets';

// What the process serves right now (issue #527), for the places that need
// the name or the source of the active dataset and cannot depend on
// DatasetsService — the audit journal it writes into, the pure projections.
// DatasetsService sets it at start and on every switch.
export type ActiveDatasetT = { id: number; name: string; source: string; own: boolean };

const requests = new AsyncLocalStorage<Dataset>();
export const requestDefault = () => requests.getStore();
export const withRequestDefault = <T>(dataset: Dataset, work: () => T): T => requests.run(dataset, work);

let active: ActiveDatasetT = { id: 1, name: DEFAULT_DATASET_NAME, source: OWN_DATASET_SOURCE, own: false };

export const setActiveDataset = (dataset: {
  id: number;
  name: string;
  source: string;
  own?: boolean;
}): void => {
  active = { id: dataset.id, name: dataset.name, source: dataset.source, own: dataset.own === true };
};

/** The active dataset: its name, its source and whether the owner created it (issue #540) */
export const getActiveDataset = (): ActiveDatasetT => requestDefault() ?? active;

export const getActiveDatasetName = (): string => getActiveDataset().name;
export const getActiveDatasetSource = (): string => getActiveDataset().source;
