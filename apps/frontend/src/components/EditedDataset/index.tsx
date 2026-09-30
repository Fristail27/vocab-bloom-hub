'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { DatasetT, DatasetsListT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { readEditedDataset, writeEditedDataset } from './cookie';

export type EditedDatasetContextT = {
  /** The datasets the instance holds; empty until the list is read, or without a session */
  datasets: DatasetT[];
  /** false on SQLite: the one dataset */
  supported: boolean;
  /** The dataset everything the admin does with the dictionary works on */
  edited: DatasetT | undefined;
  choose: (name: string) => void;
  /** Reads the datasets again: one was created, activated, deleted, its terms changed */
  reload: () => Promise<void>;
};

const EditedDatasetContext = React.createContext<EditedDatasetContextT>({
  datasets: [],
  supported: false,
  edited: undefined,
  choose: () => {},
  reload: async () => {},
});

export const useEditedDataset = (): EditedDatasetContextT => React.useContext(EditedDatasetContext);

type EditedDatasetProviderP = {
  /** The datasets as the page was rendered with them; absent without a session */
  initial?: DatasetsListT | undefined;
  children: React.ReactNode;
};

/**
 * The dataset that is edited (issue #540): the active one by default, any
 * installed dataset on a choice of the switch in the header. The choice is
 * a cookie the API layer adds to every admin request of the dictionary, so
 * it holds while the admin moves between pages; a choice of a dataset that
 * is gone falls back to the active one.
 */
export const EditedDatasetProvider: React.FC<EditedDatasetProviderP> = ({ initial, children }) => {
  const router = useRouter();
  const [list, setList] = React.useState<DatasetsListT | undefined>(initial);
  const [chosen, setChosen] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setList(initial);
  }, [initial]);

  React.useEffect(() => {
    setChosen(readEditedDataset());
  }, []);

  const datasets = React.useMemo(() => (list?.datasets ?? []).filter((dataset) => dataset.installed), [list]);
  const active = datasets.find((dataset) => dataset.active);
  const edited = datasets.find((dataset) => dataset.name === chosen) ?? active;

  // a dataset that was deleted, or activated in the meantime, is the active one again
  React.useEffect(() => {
    if (!list || !chosen) return;
    const named = datasets.find((dataset) => dataset.name === chosen);
    if (!named || named.active) {
      writeEditedDataset(undefined);
      setChosen(undefined);
      if (!named) router.refresh();
    }
  }, [list, chosen, datasets, router]);

  const choose = React.useCallback(
    (name: string) => {
      const next = datasets.find((dataset) => dataset.name === name);
      const value = !next || next.active ? undefined : next.name;
      writeEditedDataset(value);
      setChosen(value);
      // the pages rendered on the server read the cookie again
      router.refresh();
    },
    [datasets, router],
  );

  const reload = React.useCallback(async () => {
    const res = await EnApi.getDatasets();
    if (!('error' in res)) setList(res);
  }, []);

  const value = React.useMemo(
    () => ({ datasets, supported: list?.supported ?? false, edited, choose, reload }),
    [datasets, list, edited, choose, reload],
  );

  return <EditedDatasetContext.Provider value={value}>{children}</EditedDatasetContext.Provider>;
};
