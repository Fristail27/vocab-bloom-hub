'use client';

import React from 'react';
import { App, Button, Card, Collapse, Steps, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { RequestConfigForm, renderPreview } from './components/RequestConfigForm';
import { RecordsFilters } from './components/RecordsFilters';
import { RecordsTable } from './components/RecordsTable';
import { RunPanel } from './components/RunPanel';
import { RunInputT, useBulkRun } from './hooks/useBulkRun';
import { BulkItemT, BulkRequestConfigT, RunScopeE, RunStatusE, SourceKindE, SourceStateT } from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_PROMPT_TEMPLATES,
  DEFAULT_SOURCE_KIND,
  FAILURES_FILE_NAME,
  RECORDS_PAGE_SIZE,
  RESULTS_FILE_NAME,
} from './constants';
import { countActiveFilters, emptySource, listRecords } from './sources';
import { parseResponsePath } from './utils/responseMappers';
import { downloadJsonl } from './utils/jsonl';
import styles from './styles.module.scss';

const { Paragraph, Text } = Typography;

export const BulkRequestSection: React.FC = () => {
  const t = useTranslations('bulk_request');
  const tErr = useTranslations('errors');
  const { message } = App.useApp();

  const [config, setConfig] = React.useState<BulkRequestConfigT>(DEFAULT_CONFIG);
  // the chosen table and its filter
  const [source, setSource] = React.useState<SourceStateT>(emptySource(DEFAULT_SOURCE_KIND));
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<BulkItemT[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Map<number, BulkItemT>>(new Map());
  const [scope, setScope] = React.useState<RunScopeE>(RunScopeE.selected);
  // 0: request / response settings, 1: records and run
  const [step, setStep] = React.useState(0);

  const run = useBulkRun();
  const busy = run.status === RunStatusE.running || run.status === RunStatusE.loading_words;

  // the API key and the whole config are component state only: a reload drops them
  const patchConfig = React.useCallback((patch: Partial<BulkRequestConfigT>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const onSourceChange = React.useCallback((next: SourceStateT) => {
    setSource(next);
    setPage(1);
  }, []);

  // switching the table drops the filter and the selection (ids belong to one
  // table) and swaps the default prompt unless the admin has edited it
  const onSourceKindChange = React.useCallback((kind: SourceKindE) => {
    setSource((prev) => {
      if (prev.kind === kind) return prev;
      setConfig((cfg) =>
        cfg.promptTemplate === DEFAULT_PROMPT_TEMPLATES[prev.kind]
          ? { ...cfg, promptTemplate: DEFAULT_PROMPT_TEMPLATES[kind] }
          : cfg,
      );
      return emptySource(kind);
    });
    setSelected(new Map());
    setPage(1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await listRecords(source, page, RECORDS_PAGE_SIZE);
      if (cancelled) return;
      setLoading(false);
      if ('error' in res) {
        message.error(tErr(res.message));
        return;
      }
      setItems(res.items);
      setTotal(res.total);
    })();
    return () => {
      cancelled = true;
    };
    // message / tErr are stable enough; only the query inputs should refetch
  }, [source, page]);

  // warn before the tab is closed while a run is in progress: its results live in memory only
  React.useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [busy]);

  // the first step is complete once the URL is set, the body template renders
  // to valid JSON and the response path (if any) parses
  const configBlockedReason = (() => {
    if (!config.url.trim()) return t('url_required');
    if (renderPreview(config, source.kind, items[0] ?? selected.values().next().value) === null)
      return t('body_template_invalid');
    if (parseResponsePath(config.responsePath) === null) return t('response_path_invalid');
    return null;
  })();
  const scopeCount = scope === RunScopeE.selected ? selected.size : total;
  const startBlockedReason = configBlockedReason ?? (scopeCount === 0 ? t('nothing_to_run') : null);

  const runInput = (): RunInputT =>
    scope === RunScopeE.selected
      ? { mode: 'items', sourceKind: source.kind, items: [...selected.values()] }
      : { mode: 'filter', source, total };

  const activeFilters = countActiveFilters(source);

  return (
    <div className={styles.section}>
      <Paragraph type="secondary">{t('intro')}</Paragraph>

      <Steps
        current={step}
        onChange={setStep}
        items={[
          { title: t('step_request') },
          // the records step stays locked until the request settings are complete
          { title: t('step_records'), disabled: configBlockedReason !== null || busy },
        ]}
      />

      {step === 0 && (
        <Card title={t('config_title')} size="small">
          <RequestConfigForm
            config={config}
            onChange={patchConfig}
            sourceKind={source.kind}
            onSourceKindChange={onSourceKindChange}
            previewItem={items[0]}
          />
          <div className={styles.footer}>
            <Button
              type="primary"
              onClick={() => setStep(1)}
              disabled={configBlockedReason !== null}
              data-testid="bulk-next"
            >
              {t('next')}
            </Button>
            {configBlockedReason && <Text type="secondary">{configBlockedReason}</Text>}
          </div>
        </Card>
      )}

      {step === 1 && (
        <>
          <Card title={t(`source_${source.kind}`)} size="small">
            <div className={styles.records}>
              {/* filters start collapsed; the table starts open */}
              <Collapse
                size="small"
                items={[
                  {
                    key: 'filters',
                    label: activeFilters
                      ? t('filters_panel_active', { count: activeFilters })
                      : t('filters_panel'),
                    children: <RecordsFilters source={source} onChange={onSourceChange} />,
                  },
                ]}
              />
              <Collapse
                defaultActiveKey={['table']}
                items={[
                  {
                    key: 'table',
                    label: t('table_panel', { count: total }),
                    children: (
                      <RecordsTable
                        kind={source.kind}
                        items={items}
                        loading={loading}
                        page={page}
                        pageSize={RECORDS_PAGE_SIZE}
                        total={total}
                        onPageChange={setPage}
                        selected={selected}
                        onSelectionChange={setSelected}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </Card>

          <Card title={t('run_title')} size="small">
            <RunPanel
              sourceKind={source.kind}
              scope={scope}
              onScopeChange={setScope}
              selectedCount={selected.size}
              filteredTotal={total}
              status={run.status}
              progress={run.progress}
              loadedRecords={run.loadedRecords}
              failures={run.failures}
              resultsCount={run.resultsCount}
              startBlockedReason={startBlockedReason}
              loadError={run.loadError}
              onStart={() => void run.start(runInput(), config)}
              onCancel={run.cancel}
              onRetryFailed={() => void run.retryFailed(config)}
              onDownloadResults={() => downloadJsonl(run.getResults(), RESULTS_FILE_NAME)}
              onDownloadFailures={() =>
                downloadJsonl(
                  run.getFailures().map(({ identity, reason, status }) => ({
                    ...identity,
                    reason,
                    ...(status !== undefined && { status }),
                  })),
                  FAILURES_FILE_NAME,
                )
              }
            />
            <div className={styles.footer}>
              <Button onClick={() => setStep(0)} disabled={busy} data-testid="bulk-back">
                {t('back')}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
