'use client';

import React from 'react';
import {
  Alert,
  Button,
  Collapse,
  Input,
  Modal,
  Pagination,
  Progress,
  Tag,
  Empty,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { ReconciliationApi } from '@/core/api/ReconciliationApi';
import type {
  ReconciliationCategoryT,
  ReconciliationIndexT,
  ReconciliationItemT,
  ReconciliationSummaryT,
  ReconciliationPreparationT,
  ReconciliationApplicationT,
} from 'server/types/reconciliation';
import { OperationProgress } from './OperationProgress';
import { ReviewItem } from './ReviewItem';
import styles from './styles.module.scss';

export function Reconciliation({
  dataset,
  initialPlan,
  disabled,
  headword,
  onApplied,
}: {
  dataset: string;
  initialPlan?: string;
  disabled?: boolean;
  headword?: string;
  onApplied?: () => void;
}) {
  const t = useTranslations('reconciliation');
  const locale = useLocale();
  const errorText = React.useCallback(
    (message: string) => {
      if (/stale|outdated/.test(message)) return t('stale');
      if (message.includes('baseline_required')) return t('baseline_required');
      if (message.includes('reference_missing:'))
        return t('dependencies', { targets: message.split('reference_missing:')[1] });
      if (/invalid|provenance|origins_immutable/.test(message)) return t('invalid_result');
      if (message === 'import_in_progress') return t('operation_busy');
      return t('error');
    },
    [t],
  );
  const [open, setOpen] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string[]>([]);
  const jump = React.useRef<'first' | 'last' | null>(null);
  const [index, setIndex] = React.useState<ReconciliationIndexT>({ plans: [], parents: [] });
  const [selected, setSelected] = React.useState(initialPlan ?? '');
  const [summary, setSummary] = React.useState<ReconciliationSummaryT>();
  const [items, setItems] = React.useState<ReconciliationItemT[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [category, setCategory] = React.useState<ReconciliationCategoryT | undefined>('conflicts');
  const [search, setSearch] = React.useState(headword ?? '');
  const [mergeSource, setMergeSource] = React.useState<string>();
  const [twoWay, setTwoWay] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [refresh, setRefresh] = React.useState(0);
  const [preparation, setPreparation] = React.useState<ReconciliationPreparationT | null>(null);
  const [checkingPreparation, setCheckingPreparation] = React.useState(false);
  const [startingPreparation, setStartingPreparation] = React.useState(false);
  const [progressUnavailable, setProgressUnavailable] = React.useState(false);
  const [preparationCycle, setPreparationCycle] = React.useState(0);
  const preparationRef = React.useRef(preparation);
  preparationRef.current = preparation;
  const completedPreparation = React.useRef<string | undefined>(undefined);
  const preparing = startingPreparation || checkingPreparation || preparation?.state === 'running';
  const [application, setApplication] = React.useState<ReconciliationApplicationT | null>(null);
  const [applicationChecked, setApplicationChecked] = React.useState(false);
  const [startingApplication, setStartingApplication] = React.useState(false);
  const [applicationUnavailable, setApplicationUnavailable] = React.useState(false);
  const [applicationCycle, setApplicationCycle] = React.useState(0);
  const applicationRef = React.useRef(application);
  applicationRef.current = application;
  const completedApplication = React.useRef<string | undefined>(undefined);
  const applying = startingApplication || application?.state === 'running';
  const blocked = busy || preparing || applying || !applicationChecked;

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const result = await ReconciliationApi.application(dataset);
      if (!live) return;
      if ('error' in result) {
        setApplicationUnavailable(true);
        timer = setTimeout(() => void poll(), 2000);
        return;
      }
      const previous = applicationRef.current;
      const next = result.application;
      setApplicationChecked(true);
      setApplicationUnavailable(false);
      setApplication(next);
      if (next?.state === 'running') {
        setError(undefined);
        timer = setTimeout(() => void poll(), 1000);
      } else {
        setBusy(false);
        if (!next && previous?.state === 'running') {
          setError(t('application_interrupted'));
          setRefresh((n) => n + 1);
        } else if (next?.state === 'failed') {
          setError(errorText(next.failure ?? ''));
        } else if (
          next?.state === 'completed' &&
          completedApplication.current !== next.id &&
          (!initialPlan || initialPlan === next.plan_id || previous?.state === 'running')
        ) {
          completedApplication.current = next.id;
          setError(undefined);
          setSelected(next.plan_id);
          setExpanded([]);
          setRefresh((n) => n + 1);
          onApplied?.();
        }
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, dataset, applicationCycle]);

  React.useEffect(() => {
    if (!open || headword || !applicationChecked || applying) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    setCheckingPreparation(true);
    const poll = async () => {
      const result = await ReconciliationApi.preparation(dataset);
      if (!live) return;
      if ('error' in result) {
        setProgressUnavailable(true);
        timer = setTimeout(() => void poll(), 2000);
        return;
      }
      setCheckingPreparation(false);
      setProgressUnavailable(false);
      const next = result.preparation;
      if (!next && preparationRef.current?.state === 'running') setError(t('preparation_interrupted'));
      setPreparation(next);
      if (next?.state === 'running') {
        timer = setTimeout(() => void poll(), 1000);
      } else if (next?.state === 'failed') {
        setError(errorText(next.failure ?? ''));
      } else if (
        next?.state === 'completed' &&
        next.plan_id &&
        completedPreparation.current !== next.id &&
        (!application || Date.parse(next.started_at) >= Date.parse(application.started_at)) &&
        (!initialPlan || preparationRef.current?.state === 'running')
      ) {
        completedPreparation.current = next.id;
        setSelected(next.plan_id);
        setSummary(undefined);
        setItems([]);
        setExpanded([]);
        setCategory('conflicts');
        setSearch('');
        setPage(1);
        setRefresh((n) => n + 1);
      }
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, dataset, headword, preparationCycle, applicationChecked, applying]);
  React.useEffect(() => {
    if (!open || !applicationChecked || applying) return;
    let live = true;
    void ReconciliationApi.list(dataset, headword).then((result) => {
      if (live) {
        if ('error' in result) setError(errorText(result.message));
        else setIndex(result);
      }
    });
    return () => {
      live = false;
    };
  }, [dataset, open, refresh, headword, applicationChecked, applying]);
  React.useEffect(() => {
    if (!open || !selected || !applicationChecked || applying) return;
    let live = true;
    setBusy(true);
    void Promise.all([
      ReconciliationApi.summary(dataset, selected),
      ReconciliationApi.items(dataset, selected, page, category, search),
    ]).then(([summary, list]) => {
      if (!live) return;
      setBusy(false);
      if ('error' in summary || 'error' in list) {
        setError(t('error'));
        return;
      }
      setSummary(summary);
      setItems(list.items);
      if (jump.current) {
        const next = jump.current === 'first' ? list.items[0] : list.items.at(-1);
        setExpanded(next ? [next.headword] : []);
        jump.current = null;
      }
      setTotal(list.total);
    });
    return () => {
      live = false;
    };
  }, [dataset, open, selected, page, category, search, refresh, applicationChecked, applying]);
  const prepare = async (source: string, allowTwoWay = false) => {
    setStartingPreparation(true);
    setError(undefined);
    const result = await ReconciliationApi.prepare(dataset, source, allowTwoWay);
    setStartingPreparation(false);
    if ('error' in result) setError(errorText(result.message));
    else {
      setPreparation(result);
      setSelected('');
      setSummary(undefined);
      setItems([]);
    }
    // Also recover a job whose acknowledgement was lost in transit.
    setPreparationCycle((n) => n + 1);
  };
  const navigate = (direction: number) => {
    const at = items.findIndex((item) => item.headword === expanded[0]);
    const next = at < 0 ? (direction > 0 ? 0 : items.length - 1) : at + direction;
    if (items[next]) setExpanded([items[next].headword]);
    else if (page + direction > 0 && (page + direction - 1) * 25 < total) {
      jump.current = direction > 0 ? 'first' : 'last';
      setPage(page + direction);
    }
  };
  const finish = async (apply: boolean) => {
    setError(undefined);
    if (apply) {
      setStartingApplication(true);
      const result = await ReconciliationApi.apply(dataset, selected);
      setStartingApplication(false);
      if ('error' in result) setError(errorText(result.message));
      else setApplication(result);
      // Recover an accepted start even if its acknowledgement was lost.
      setApplicationChecked(false);
      setApplicationCycle((n) => n + 1);
    } else {
      setBusy(true);
      const result = await ReconciliationApi.cancel(dataset, selected);
      setBusy(false);
      if ('error' in result) setError(errorText(result.message));
      else setRefresh((n) => n + 1);
    }
  };
  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          setApplicationChecked(false);
          setOpen(true);
          if (initialPlan) setSelected(initialPlan);
        }}
      >
        {t(initialPlan ? 'review' : 'title')}
      </Button>
      <Modal
        open={open}
        title={`${t('title')} · ${dataset}`}
        width={1280}
        style={{ top: 24 }}
        classNames={{ body: styles.modalBody, footer: styles.modalFooter }}
        onCancel={() => {
          if (!dirty) setOpen(false);
        }}
        footer={
          summary && !preparing && !applying && applicationChecked && summary.status === 'review' ? (
            <div className={styles.applyBar}>
              <span>
                {dirty
                  ? t('unsaved')
                  : summary.remaining_conflicts
                    ? t('remaining_count', { count: summary.remaining_conflicts })
                    : t('ready_to_apply')}
              </span>
              <Space wrap>
                <Button disabled={busy || dirty} onClick={() => void finish(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  type="primary"
                  aria-label={t('apply')}
                  loading={busy}
                  disabled={busy || dirty || summary.remaining_conflicts > 0}
                  onClick={() => void finish(true)}
                >
                  {t('apply')}
                </Button>
              </Space>
            </div>
          ) : null
        }
      >
        <div className={styles.review}>
          {dirty && <Alert type="warning" title={t('unsaved')} />}
          {error && <Alert type="error" title={error} closable onClose={() => setError(undefined)} />}
          {(progressUnavailable || applicationUnavailable) && (
            <Alert type="warning" title={t('progress_unavailable')} />
          )}
          {application?.state === 'running' && <OperationProgress progress={application} />}
          {preparation?.state === 'running' && !applying && <OperationProgress progress={preparation} />}
          <Typography.Paragraph className={styles.hint}>
            {t(selected ? 'review_hint' : 'hint')}
          </Typography.Paragraph>
          {!headword && (index.parents.length > 0 || Boolean(index.sources?.length)) && (
            <details className={styles.setup} open={!selected}>
              <summary>{t('prepare')}</summary>
              <div className={styles.review}>
                <Space wrap>
                  {index.parents
                    .filter((parent) => !headword && parent.source !== dataset)
                    .map((parent) => (
                      <Button
                        disabled={dirty || blocked}
                        key={parent.lineage}
                        onClick={() => void prepare(parent.source)}
                      >
                        {t('parent', { name: parent.source })}
                      </Button>
                    ))}
                </Space>
                {!headword && Boolean(index.sources?.length) && (
                  <Space wrap>
                    <Select
                      disabled={dirty || blocked}
                      aria-label={t('merge_source')}
                      placeholder={t('merge_source')}
                      value={mergeSource}
                      onChange={setMergeSource}
                      options={index.sources?.map((source) => ({ value: source.name, label: source.title }))}
                    />
                    <Switch
                      checked={twoWay}
                      onChange={setTwoWay}
                      disabled={dirty || blocked}
                      aria-label={t('two_way')}
                    />
                    <Typography.Text>{t('two_way')}</Typography.Text>
                    <Button
                      aria-label={t('prepare')}
                      loading={startingPreparation}
                      disabled={!mergeSource || dirty || blocked}
                      onClick={() => mergeSource && void prepare(mergeSource, twoWay)}
                    >
                      {t('prepare')}
                    </Button>
                  </Space>
                )}
              </div>
            </details>
          )}
          <Select
            disabled={dirty || blocked}
            aria-label={t('operations')}
            placeholder={t('operations')}
            value={selected || undefined}
            onChange={(id) => {
              setSelected(id);
              setSummary(undefined);
              setItems([]);
              setExpanded([]);
              setPage(1);
            }}
            options={index.plans.map((plan) => ({
              value: plan.id,
              label: `${new Date(plan.created_at).toLocaleString(locale)} · ${t(plan.status === 'review' ? 'review_state' : plan.status)}`,
            }))}
          />
          {summary && !preparing && !applying && applicationChecked && (
            <>
              {summary.status === 'review' && summary.baseline_available === false && (
                <Alert type="warning" title={t('legacy_review')} />
              )}
              {summary.status === 'review' && summary.incoming_complete === false && (
                <Alert type="info" title={t('partial')} />
              )}
              <div className={styles.stats}>
                {(['conflicts', 'added', 'changed', 'deleted'] as const).map((key) => (
                  <button
                    type="button"
                    disabled={dirty || busy}
                    className={styles.stat}
                    aria-pressed={category === key}
                    data-kind={key}
                    key={key}
                    onClick={() => {
                      setCategory(key);
                      setExpanded([]);
                      setPage(1);
                    }}
                  >
                    <span>{t(key)}</span>
                    <strong>{summary.counts[key].toLocaleString(locale)}</strong>
                  </button>
                ))}
              </div>
              <div className={styles.reviewStatus} data-ready={summary.remaining_conflicts === 0}>
                <div className={styles.statusHeading}>
                  <strong>
                    {summary.status !== 'review'
                      ? t(summary.status)
                      : summary.remaining_conflicts
                        ? t('remaining_count', { count: summary.remaining_conflicts })
                        : t('ready_to_apply')}
                  </strong>
                  <span>{t(summary.status === 'applied' ? 'actual' : 'proposed', summary.proposed)}</span>
                </div>
                {summary.counts.conflicts > 0 && summary.status === 'review' && (
                  <>
                    <span>
                      {t('resolved', {
                        count: summary.resolved_articles,
                        total: summary.counts.conflicts,
                        remaining: summary.remaining_conflicts,
                      })}
                    </span>
                    <Progress
                      size="small"
                      showInfo={false}
                      aria-label={t('conflicts')}
                      percent={Math.round((summary.resolved_articles / summary.counts.conflicts) * 100)}
                    />
                  </>
                )}
              </div>
              <div className={styles.toolbar}>
                <Button
                  disabled={dirty || busy}
                  aria-pressed={category === undefined}
                  type={category === undefined ? 'primary' : 'default'}
                  onClick={() => {
                    setCategory(undefined);
                    setExpanded([]);
                    setPage(1);
                  }}
                >
                  {t('all')}
                </Button>
                <Input.Search
                  disabled={dirty}
                  aria-label={t('search')}
                  placeholder={t('search')}
                  onSearch={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                />
                <Space wrap>
                  <Button disabled={dirty || busy || !items.length} onClick={() => navigate(-1)}>
                    {t('previous')}
                  </Button>
                  <Button disabled={dirty || busy || !items.length} onClick={() => navigate(1)}>
                    {t('next')}
                  </Button>
                </Space>
              </div>
              {!items.length && !busy && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('no_results')} />
              )}
              <Collapse
                className={styles.articles}
                destroyOnHidden
                accordion
                activeKey={expanded}
                onChange={(keys) => {
                  if (!dirty) setExpanded(keys);
                }}
                items={items.map((item) => ({
                  key: item.headword,
                  label: (
                    <div className={styles.articleLabel}>
                      <strong dir="auto">{item.headword}</strong>
                      <Tag
                        color={
                          item.category === 'conflicts'
                            ? item.remaining
                              ? 'warning'
                              : 'success'
                            : item.category === 'added'
                              ? 'success'
                              : item.category === 'deleted'
                                ? 'error'
                                : 'default'
                        }
                      >
                        {item.category === 'conflicts'
                          ? item.remaining
                            ? t('remaining_count', { count: item.remaining })
                            : t('decision_saved')
                          : t(item.category)}
                      </Tag>
                    </div>
                  ),
                  children: (
                    <ReviewItem
                      onDirty={setDirty}
                      item={item}
                      dataset={dataset}
                      source={summary.source}
                      readOnly={summary.status !== 'review'}
                      saved={() => setRefresh((n) => n + 1)}
                      failed={(message) => setError(errorText(message))}
                    />
                  ),
                }))}
              />
              <Pagination
                current={page}
                pageSize={25}
                total={total}
                showSizeChanger={false}
                disabled={busy || dirty}
                onChange={setPage}
              />
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
