import { AsyncLocalStorage } from 'node:async_hooks';
import type { DataSource, EntityManager, ObjectLiteral, Repository } from 'typeorm';
import { getActiveDataset } from './active-dataset';

// The dataset an admin request works on (issue #540): the one the switch of
// the admin UI names, when it is not the active one. The edit services of
// the dictionary hold the repositories of the application's connection —
// the active dataset; a request that names another dataset runs inside a
// scope that carries a connection on that dataset's schema, and the
// services take their repositories from it. What the scope is, is said
// around the request, not passed through every signature — the way
// `withChangeSource` says where an edit comes from.

export type DatasetScopeT = {
  /** The dataset of the registry, as DatasetsService found it */
  dataset: { name: string; source: string; own: boolean };
  /** A connection on the dataset's schema */
  dataSource: DataSource;
};

const storage = new AsyncLocalStorage<DatasetScopeT>();

export const withDatasetScope = <T>(scope: DatasetScopeT, work: () => T): T => storage.run(scope, work);

/** The scope of the request being handled; null when it works on the active dataset */
export const currentDatasetScope = (): DatasetScopeT | null => storage.getStore() ?? null;

/** The dataset the request works on: the one it named, else the active one */
export const currentDataset = (): { name: string; source: string; own: boolean } =>
  storage.getStore()?.dataset ?? getActiveDataset();

/** The name of the dataset the request works on: the one it named, else the active one */
export const currentDatasetName = (): string => currentDataset().name;

/** What the data of the dataset the request works on is called in the API: its `source` */
export const currentDatasetSource = (): string => currentDataset().source;

/** The repository of the dataset the request works on: the one given is the active dataset's */
export const scoped = <T extends ObjectLiteral>(repository: Repository<T>): Repository<T> => {
  const scope = storage.getStore();
  return scope ? scope.dataSource.getRepository<T>(repository.target) : repository;
};

/** The connection of the dataset the request works on: the one given is the active dataset's */
export const scopedDataSource = (dataSource: DataSource): DataSource =>
  storage.getStore()?.dataSource ?? dataSource;

/** The manager of the dataset the request works on */
export const scopedManager = (manager: EntityManager): EntityManager =>
  storage.getStore()?.dataSource.manager ?? manager;
