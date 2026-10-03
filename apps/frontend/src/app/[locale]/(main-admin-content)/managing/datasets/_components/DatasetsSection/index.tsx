'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, App, Modal, Progress, Typography } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { DATASET_CATALOG, DatasetCatalogEntryT } from 'server/core/constants/dataset_catalog';
import type { ForkProgressT } from 'server/types';
import { DatasetT, DatasetUpdateT, DatasetsListT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { useEditedDataset } from '@/components/EditedDataset';
import { ImportDictionarySection } from '../ImportDictionarySection';
import { ExportDictionarySection } from '../ExportDictionarySection';
import { DatasetActionsT, DatasetCard } from './components/DatasetCard';
import { InstallDataset } from './components/InstallDataset';
import { OwnDatasetForm } from './components/OwnDatasetForm';
import { OwnDatasets } from './components/OwnDatasets';
import styles from './styles.module.scss';

const { Title } = Typography;

type DatasetsSectionP = {
  /** The list fetched with the page; absent when the request failed */
  initial?: DatasetsListT | undefined;
};

type TermsDialogT = { dataset?: DatasetT | undefined; parent?: DatasetT | undefined } | null;

/**
 * The datasets of the instance (issues #527, #540), and everything that is
 * done with one: every dataset of the catalog, installed or not, with the
 * terms it comes under, and the datasets of the instance's own under them.
 * A card activates its dataset, opens its words for editing, imports into
 * it, exports it, installs or updates it from the file of its source and —
 * for a dataset of the owner's — corrects its terms. On a driver without
 * schemas (SQLite) the cards are shown and nothing can be installed or
 * created; the one dataset is still imported and exported.
 */
export const DatasetsSection: React.FC<DatasetsSectionP> = ({ initial }) => {
  const locale = useLocale();
  const params = useSearchParams();
  const p = useTranslations('provenance');
  const [fork, setFork] = React.useState<ForkProgressT | null>(null);
  const router = useRouter();
  const t = useTranslations('datasets');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();
  // stable: reads the datasets for the switch of the header, whatever it holds
  const { reload: reloadSwitch, choose } = useEditedDataset();

  const [list, setList] = React.useState<DatasetsListT | undefined>(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [instruction, setInstruction] = React.useState<DatasetCatalogEntryT | null>(null);
  const [importing, setImporting] = React.useState<DatasetT | null>(null);
  const [exporting, setExporting] = React.useState<DatasetT | null>(null);
  const [terms, setTerms] = React.useState<TermsDialogT>(null);
  // what the sources of the installed datasets have now (issue #530); a
  // notice, so a failure of the request is no error of the page
  const [updates, setUpdates] = React.useState<DatasetUpdateT[]>([]);

  const checkUpdates = React.useCallback(async () => {
    const res = await EnApi.getDatasetUpdates();
    setUpdates('error' in res ? [] : res.datasets);
  }, []);

  const reload = React.useCallback(async () => {
    const res = await EnApi.getDatasets();
    if ('error' in res) {
      message.error(tErr(res.message));
      return;
    }
    setList(res);
    // the switch of the dataset that is edited offers what the instance holds now (issue #540)
    void reloadSwitch();
    // the version that is installed may have changed: the notice is about it
    await checkUpdates();
  }, [message, tErr, checkUpdates, reloadSwitch]);

  React.useEffect(() => {
    if (initial) void checkUpdates();
    else void reload();
  }, [initial, reload, checkUpdates]);

  const run = async (
    key: string,
    call: () => Promise<{ error?: boolean; message?: string } | object>,
    done: string,
  ) => {
    setBusy(key);
    const res = (await call()) as { error?: boolean; message?: string };
    setBusy(null);
    if (res.error) {
      message.error(tErr(res.message ?? 'unknown_error'));
      return;
    }
    message.success(done);
    await reload();
  };

  React.useEffect(() => {
    const named = params.get('fork');
    const parent = list?.datasets.find((dataset) => dataset.name === named && dataset.installed);
    if (parent && list?.supported) {
      setTerms({ parent });
      router.replace(`/${locale}/managing/datasets`);
    }
  }, [params, list, router, locale]);

  React.useEffect(() => {
    if (!fork || fork.state !== 'copying') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const progress = await EnApi.forkStatus(fork.name);
      if (cancelled) return;
      if ('error' in progress) {
        setFork({ ...fork, state: 'failed', failure: progress.message });
        return;
      }
      setFork(progress);
      if (progress.state === 'completed') {
        message.success(p('fork_done'));
        void reload();
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fork, message, p, reload]);

  const supported = list?.supported ?? false;
  const finalizingFork =
    fork?.state === 'copying' && fork.total_tables > 0 && fork.completed_tables >= fork.total_tables;
  // the state of a dataset of the catalog; a dataset of the owner's under its name is none of it (issue #540)
  const stateOf = (name: string): DatasetT | undefined =>
    list?.datasets.find((dataset) => dataset.name === name && !dataset.own);

  const actions: DatasetActionsT = {
    fork: (parent) => setTerms({ parent }),
    activate: (dataset) =>
      void run(
        `activate ${dataset.name}`,
        () => EnApi.activateDataset(dataset.name),
        t('activated', { name: dataset.title }),
      ),
    // its words are edited through the switch of the header: the managing page opens on them
    edit: (dataset) => {
      choose(dataset.name);
      router.push(`/${locale}/managing`);
    },
    import: setImporting,
    export: setExporting,
    install: setInstruction,
    editTerms: (dataset) => setTerms({ dataset }),
    remove: (dataset) =>
      void run(`delete ${dataset.name}`, () => EnApi.deleteDataset(dataset.name), t('deleted')),
  };

  const card = (entry: DatasetCatalogEntryT | undefined, dataset: DatasetT | undefined) => (
    <DatasetCard
      key={dataset?.name ?? entry?.name}
      entry={entry}
      dataset={dataset}
      update={dataset?.installed ? updates.find((item) => item.name === dataset.name) : undefined}
      supported={supported}
      busy={busy}
      actions={actions}
    />
  );

  return (
    <div className={styles.section}>
      {fork && (
        <Alert
          type={fork.state === 'failed' ? 'error' : fork.state === 'completed' ? 'success' : 'info'}
          title={
            fork.state === 'failed'
              ? tErr(fork.failure ?? 'unknown_error')
              : p(
                  fork.state === 'completed'
                    ? 'fork_done'
                    : finalizingFork
                      ? 'fork_finalizing'
                      : 'fork_progress',
                )
          }
          description={
            <Progress
              status={fork.state === 'completed' ? 'success' : fork.state === 'failed' ? 'exception' : 'active'}
              percent={
                fork.state === 'completed'
                  ? 100
                  : Math.min(99, Math.round((fork.completed_tables / Math.max(1, fork.total_tables)) * 100))
              }
            />
          }
        />
      )}
      {list && !supported && (
        <Alert type="info" showIcon title={t('not_supported')} data-testid="datasets-unsupported" />
      )}
      <Title level={3} className={styles.sectionTitle}>
        {t('catalog_title')}
      </Title>
      {DATASET_CATALOG.map((entry) => card(entry, stateOf(entry.name)))}
      <OwnDatasets
        datasets={list?.datasets.filter((dataset) => dataset.own) ?? []}
        supported={supported}
        onCreate={() => setTerms({})}
        renderCard={(dataset) => card(undefined, dataset)}
      />

      <InstallDataset
        entry={instruction}
        installed={instruction ? (stateOf(instruction.name)?.installed ?? false) : false}
        supported={supported}
        onClose={() => setInstruction(null)}
        onFinished={() => void reload()}
      />
      <OwnDatasetForm
        open={!!terms}
        dataset={terms?.dataset}
        parent={terms?.parent}
        onForkStarted={(progress) => {
          setFork(progress);
          setTerms(null);
          router.replace(`/${locale}/managing/datasets`);
        }}
        onClose={() => setTerms(null)}
        onSaved={() => {
          setTerms(null);
          void reload();
        }}
      />
      {/* an import or an export keeps its dialog until it is closed: the stream is read by it */}
      <Modal
        open={!!importing}
        title={importing ? t('import_title', { name: importing.title }) : ''}
        footer={null}
        width={760}
        mask={{ closable: false }}
        destroyOnHidden
        onCancel={() => setImporting(null)}
      >
        {importing && <ImportDictionarySection dataset={importing} onFinished={() => void reload()} />}
      </Modal>
      <Modal
        open={!!exporting}
        title={exporting ? t('export_title', { name: exporting.title }) : ''}
        footer={null}
        width={640}
        mask={{ closable: false }}
        destroyOnHidden
        onCancel={() => setExporting(null)}
      >
        {exporting && <ExportDictionarySection dataset={exporting} />}
      </Modal>
    </div>
  );
};
