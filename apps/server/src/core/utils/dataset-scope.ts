import { AsyncLocalStorage } from 'node:async_hooks';
import type { DataSource, EntityManager, ObjectLiteral, Repository } from 'typeorm';
import { type ActiveDatasetT, getActiveDataset } from './active-dataset';

// Named requests and pinned operations carry the registry identity through async work.
export type DatasetScopeT = {
  /** The dataset of the registry, as DatasetsService found it */
  dataset: ActiveDatasetT;
  /** Dataset-scoped access to the application pool */
  dataSource: DataSource;
  /** A pinned connection/transaction, when the entire operation must use one */
  manager?: EntityManager;
};

const storage = new AsyncLocalStorage<DatasetScopeT>();

export const withDatasetScope = <T>(scope: DatasetScopeT, work: () => T): T => storage.run(scope, work);

/** The scope of the request being handled; null when it works on the active dataset */
export const currentDatasetScope = (): DatasetScopeT | null => storage.getStore() ?? null;

/** The dataset the request works on: the one it named, else the active one */
export const currentDataset = (): ActiveDatasetT => storage.getStore()?.dataset ?? getActiveDataset();

/** The name of the dataset the request works on: the one it named, else the active one */
export const currentDatasetName = (): string => currentDataset().name;

/** What the data of the dataset the request works on is called in the API: its `source` */
export const currentDatasetSource = (): string => currentDataset().source;

/** The repository of the dataset the request works on: the one given is the active dataset's */
export const scoped = <T extends ObjectLiteral>(repository: Repository<T>): Repository<T> => {
  const scope = storage.getStore();
  return scope ? (scope.manager ?? scope.dataSource).getRepository<T>(repository.target) : repository;
};

/** The connection of the dataset the request works on: the one given is the active dataset's */
export const scopedDataSource = (dataSource: DataSource): DataSource =>
  storage.getStore()?.dataSource ?? dataSource;

/** The manager of the dataset the request works on */
export const scopedManager = (manager: EntityManager): EntityManager =>
  storage.getStore()?.manager ?? storage.getStore()?.dataSource.manager ?? manager;
