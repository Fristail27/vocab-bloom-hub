import { DatasetT, GetDatasetsResT } from 'server/types';
import { getServerDataset } from '@/core/api/AbstractBaseApi/ServerWrapper';

/**
 * The dataset a page of the admin UI works on, rendered on the server
 * (issue #540): the one the switch of the header names, else the active one.
 * Undefined when the list of datasets could not be read.
 */
export const getEditedDataset = async (datasets: GetDatasetsResT): Promise<DatasetT | undefined> => {
  if ('error' in datasets) return undefined;
  const chosen = await getServerDataset();
  return (
    datasets.datasets.find((dataset) => dataset.installed && dataset.name === chosen) ??
    datasets.datasets.find((dataset) => dataset.active)
  );
};
