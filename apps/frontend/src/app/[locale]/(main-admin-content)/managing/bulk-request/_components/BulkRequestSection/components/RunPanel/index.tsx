'use client';

import React from 'react';
import { Alert, Button, Progress, Radio, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { RunFailureT, RunProgressT, RunScopeE, RunStatusE, SourceKindE } from '../../types';
import { FAILURES_PREVIEW_LIMIT } from '../../constants';
import styles from './styles.module.scss';

const { Text, Title } = Typography;

type RunPanelP = {
  sourceKind: SourceKindE;
  scope: RunScopeE;
  onScopeChange: (scope: RunScopeE) => void;
  selectedCount: number;
  filteredTotal: number;
  status: RunStatusE;
  progress: RunProgressT;
  loadedRecords: { loaded: number; total: number };
  failures: RunFailureT[];
  resultsCount: number;
  // a human-readable reason the run cannot start, or null when it can
  startBlockedReason: string | null;
  loadError: string | null;
  onStart: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
  onDownloadResults: () => void;
  onDownloadFailures: () => void;
};

export const RunPanel: React.FC<RunPanelP> = ({
  sourceKind,
  scope,
  onScopeChange,
  selectedCount,
  filteredTotal,
  status,
  progress,
  loadedRecords,
  failures,
  resultsCount,
  startBlockedReason,
  loadError,
  onStart,
  onCancel,
  onRetryFailed,
  onDownloadResults,
  onDownloadFailures,
}) => {
  const t = useTranslations('bulk_request');
  const tErr = useTranslations('errors');

  const busy = status === RunStatusE.running || status === RunStatusE.loading_words;
  const finished = status === RunStatusE.done || status === RunStatusE.cancelled;
  const percent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 1000) / 10 : 0;
  const hasNetworkFailure = failures.some((f) => f.reason.startsWith('network error'));

  const statusText = (() => {
    if (status === RunStatusE.loading_words) return t('status_loading_records', loadedRecords);
    if (status === RunStatusE.running) return t('status_running', progress);
    if (status === RunStatusE.done) return t('status_done', progress);
    if (status === RunStatusE.cancelled) return t('status_cancelled', progress);
    return '';
  })();

  const failureColumns: ColumnsType<RunFailureT> = [
    { title: t('col_word'), key: 'word', render: (_, f) => f.identity.word },
    { title: t('col_part_of_speech'), key: 'part_of_speech', render: (_, f) => f.identity.part_of_speech },
    // meanings and translations are told apart by their title
    ...(sourceKind !== SourceKindE.words
      ? [
          {
            title: t('col_record'),
            key: 'label',
            ellipsis: true,
            render: (_: unknown, f: RunFailureT) => f.label,
          },
        ]
      : []),
    { title: t('col_reason'), dataIndex: 'reason', key: 'reason', ellipsis: true },
  ];

  return (
    <div className={styles.panel}>
      <Radio.Group value={scope} onChange={(e) => onScopeChange(e.target.value as RunScopeE)} disabled={busy}>
        <Radio value={RunScopeE.selected}>{t('scope_selected', { count: selectedCount })}</Radio>
        <Radio value={RunScopeE.filtered}>{t('scope_filtered', { count: filteredTotal })}</Radio>
      </Radio.Group>

      <div className={styles.actions}>
        {!busy && (
          <Button
            type="primary"
            onClick={onStart}
            disabled={startBlockedReason !== null}
            data-testid="bulk-start"
          >
            {t('start')}
          </Button>
        )}
        {busy && (
          <Button danger onClick={onCancel} data-testid="bulk-cancel">
            {t('cancel')}
          </Button>
        )}
        {finished && failures.length > 0 && (
          <Button onClick={onRetryFailed}>{t('retry_failed', { count: failures.length })}</Button>
        )}
        {finished && resultsCount > 0 && (
          <Button onClick={onDownloadResults} data-testid="bulk-download-results">
            {t('download_results', { count: resultsCount })}
          </Button>
        )}
        {finished && failures.length > 0 && (
          <Button onClick={onDownloadFailures} data-testid="bulk-download-failures">
            {t('download_failures', { count: failures.length })}
          </Button>
        )}
        {!busy && startBlockedReason && <Text type="secondary">{startBlockedReason}</Text>}
      </div>

      {loadError && <Alert type="error" showIcon title={tErr(loadError)} />}

      {status !== RunStatusE.idle && (
        <>
          <Progress
            percent={percent}
            status={busy ? 'active' : status === RunStatusE.cancelled ? 'exception' : 'success'}
            format={(p = 0) => `${p.toFixed(1)}%`}
          />
          <Text italic data-testid="bulk-status">
            {statusText}
          </Text>
        </>
      )}

      {busy && <Alert type="warning" showIcon title={t('leave_warning')} />}
      {hasNetworkFailure && <Alert type="info" showIcon title={t('network_hint')} />}

      {failures.length > 0 && (
        <div className={styles.failures}>
          <Title level={5}>{t('failures_title')}</Title>
          {failures.length > FAILURES_PREVIEW_LIMIT && (
            <Text type="secondary">
              {t('failures_preview', { shown: FAILURES_PREVIEW_LIMIT, count: failures.length })}
            </Text>
          )}
          <Table<RunFailureT>
            rowKey={(f) => `${f.item.id}`}
            size="small"
            columns={failureColumns}
            dataSource={failures.slice(0, FAILURES_PREVIEW_LIMIT)}
            pagination={false}
          />
        </div>
      )}
    </div>
  );
};
