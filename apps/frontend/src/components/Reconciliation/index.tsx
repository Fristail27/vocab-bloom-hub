'use client';

import React from 'react';
import {
  Alert,
  Button,
  Collapse,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { ReconciliationApi } from '@/core/api/ReconciliationApi';
import type {
  ReconciliationCategoryT,
  ReconciliationDecisionT,
  ReconciliationIndexT,
  ReconciliationItemT,
  ReconciliationSideT,
  ReconciliationSummaryT,
  ReconciliationValueT,
} from 'server/types/reconciliation';
import styles from './styles.module.scss';

const opaque = (key: string) => /^[\da-f]{8}-[\da-f-]{27}$/i.test(key);

function recordOptions(side?: ReconciliationSideT): [string, ReconciliationValueT][] {
  if (!side?.present || !side.value || typeof side.value !== 'object' || Array.isArray(side.value)) return [];
  const entries = Object.entries(side.value);
  return entries.every(([key]) => opaque(key)) ? entries : [];
}

function contextTitle(side: ReconciliationSideT | undefined, path: string[]): string {
  if (!side?.present) return '';
  let value = side.value;
  const labels: string[] = [];
  for (const key of path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) break;
    value = value[key];
    if (opaque(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      const label = value.title || value.word || value.description || value.text || value.language;
      if (typeof label === 'string') labels.push(label);
    }
  }
  return labels.join(' › ');
}

function Value({
  value,
  change,
}: {
  value: ReconciliationValueT;
  change?: (value: ReconciliationValueT) => void;
}) {
  const t = useTranslations('reconciliation');
  const fields = useTranslations('en_managing_words');
  if (typeof value === 'string')
    return change ? (
      <Input.TextArea
        aria-label={t('result')}
        value={value}
        onChange={(event) => change(event.target.value)}
        autoSize
      />
    ) : (
      <span className={styles.text}>{value || '—'}</span>
    );
  if (typeof value === 'boolean')
    return change ? (
      <Switch aria-label={t('result')} checked={value} onChange={change} />
    ) : (
      <span>{t(value ? 'yes' : 'no')}</span>
    );
  if (typeof value === 'number')
    return change ? (
      <InputNumber aria-label={t('result')} value={value} onChange={(next) => change(next)} />
    ) : (
      <span>{value}</span>
    );
  if (value === null)
    return change ? (
      <Input.TextArea
        aria-label={t('result')}
        value=""
        onChange={(event) => change(event.target.value || null)}
        autoSize
      />
    ) : (
      <span>—</span>
    );
  if (Array.isArray(value))
    return (
      <div className={styles.values}>
        {value.map((item, index) => (
          <div key={index} className={styles.value}>
            <Value
              value={item}
              {...(change && {
                change: (next: ReconciliationValueT) =>
                  change(value.map((old, i) => (i === index ? next : old))),
              })}
            />
            {change && (
              <Button size="small" onClick={() => change(value.filter((_, i) => i !== index))}>
                {t('remove')}
              </Button>
            )}
          </div>
        ))}
        {change && value.every((item) => typeof item === 'string') && (
          <Button size="small" onClick={() => change([...value, ''])}>
            {t('add')}
          </Button>
        )}
      </div>
    );
  return (
    <dl className={styles.values}>
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          {!opaque(key) && <dt>{fields.has(key) ? fields(key) : key.replaceAll('_', ' ')}</dt>}
          <dd>
            {opaque(key) && change && (
              <Button
                size="small"
                onClick={() =>
                  change(Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)))
                }
              >
                {t('remove')}
              </Button>
            )}
            <Value
              value={item}
              {...(change &&
                key !== 'origins' && {
                  change: (next: ReconciliationValueT) => change({ ...value, [key]: next }),
                })}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const sideValue = (side: ReconciliationSideT, absent: string) =>
  side.present ? <Value value={side.value} /> : <em>{absent}</em>;

function ReviewItem({
  item,
  dataset,
  readOnly,
  saved,
  failed,
  onDirty,
}: {
  onDirty: (dirty: boolean) => void;
  item: ReconciliationItemT;
  dataset: string;
  readOnly: boolean;
  saved: () => void;
  failed: (message: string) => void;
}) {
  const t = useTranslations('reconciliation');
  const [draft, setDraft] = React.useState(item.decisions);
  const [whole, setWhole] = React.useState<ReconciliationSideT>();
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setDraft(item.decisions);
    setWhole(undefined);
  }, [item]);
  const dirty = whole !== undefined || JSON.stringify(draft) !== JSON.stringify(item.decisions);
  React.useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const select = (decision: ReconciliationDecisionT) =>
    setDraft((old) => [
      ...old.filter((row) => JSON.stringify(row.path) !== JSON.stringify(decision.path)),
      decision,
    ]);
  const save = async () => {
    setBusy(true);
    const result = whole
      ? await ReconciliationApi.override(dataset, item.plan, item.headword, item.version, whole)
      : await ReconciliationApi.decide(dataset, item.plan, item.headword, item.version, draft);
    setBusy(false);
    if ('error' in result) failed(result.message);
    else {
      onDirty(false);
      saved();
    }
  };
  return (
    <div className={styles.review}>
      {item.comparison.conflicts.map((conflict) => {
        const key = JSON.stringify(conflict.path);
        const decision = draft.find((row) => JSON.stringify(row.path) === key);
        const result =
          decision?.choice === 'custom'
            ? decision.result
            : decision?.choice === 'incoming'
              ? conflict.incoming
              : conflict.local;
        return (
          <section key={key} className={styles.conflict}>
            {conflict.targets && (
              <Alert type="warning" title={t('dependencies', { targets: conflict.targets.join(', ') })} />
            )}
            <Typography.Text>
              {contextTitle(item.local, conflict.path) || contextTitle(item.incoming, conflict.path)}
            </Typography.Text>
            <Typography.Text strong>
              {conflict.path.filter((part) => !opaque(part)).join(' › ') || item.headword}
            </Typography.Text>
            <div className={styles.columns}>
              {(['baseline', 'local', 'incoming'] as const).map((side) => (
                <div key={side}>
                  <h4>{t(side)}</h4>
                  {sideValue(conflict[side], t('absent'))}
                </div>
              ))}
            </div>
            {!readOnly && (
              <Space wrap>
                <Button
                  type={decision?.choice === 'local' ? 'primary' : 'default'}
                  onClick={() => select({ path: conflict.path, choice: 'local' })}
                >
                  {t('keep')}
                </Button>
                <Button
                  type={decision?.choice === 'incoming' ? 'primary' : 'default'}
                  onClick={() => select({ path: conflict.path, choice: 'incoming' })}
                >
                  {t('accept')}
                </Button>
                <Button
                  type={decision?.choice === 'custom' ? 'primary' : 'default'}
                  onClick={() =>
                    select({
                      path: conflict.path,
                      choice: 'custom',
                      result: conflict.local.present ? conflict.local : conflict.incoming,
                    })
                  }
                >
                  {t('edit')}
                </Button>
              </Space>
            )}
            {!readOnly && decision?.choice === 'custom' && (
              <Space wrap>
                {(['local', 'incoming'] as const).flatMap((side) =>
                  recordOptions(conflict[side])
                    .filter(([key]) => !recordOptions(result).some(([current]) => current === key))
                    .map(([key, value], index) => (
                      <Button
                        key={`${side}:${key}`}
                        onClick={() =>
                          select({
                            path: conflict.path,
                            choice: 'custom',
                            result: {
                              present: true,
                              value: { ...Object.fromEntries(recordOptions(result)), [key]: value },
                            },
                          })
                        }
                      >
                        {t('add')} · {t(side)} ·{' '}
                        {typeof value === 'object' &&
                        value !== null &&
                        !Array.isArray(value) &&
                        typeof value.title === 'string'
                          ? value.title
                          : index + 1}
                      </Button>
                    )),
                )}
              </Space>
            )}
            {decision && (
              <div className={styles.result}>
                <h4>{t('result')}</h4>
                {result?.present ? (
                  <Value
                    value={result.value}
                    {...(!readOnly &&
                      decision.choice === 'custom' && {
                        change: (value: ReconciliationValueT) =>
                          select({ path: conflict.path, choice: 'custom', result: { present: true, value } }),
                      })}
                  />
                ) : (
                  <em>{t('absent')}</em>
                )}
              </div>
            )}
          </section>
        );
      })}
      {item.comparison.conflicts.length === 0 && (
        <div className={styles.columns}>
          {(['baseline', 'local', 'incoming'] as const).map((side) => (
            <div key={side}>
              <h4>{t(side)}</h4>
              {sideValue(item[side] ?? { present: false }, t('absent'))}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <Space wrap>
          <Button onClick={() => setWhole(item.result)}>{t('edit')}</Button>
          <Button onClick={() => setWhole(item.local ?? { present: false })}>{t('keep')}</Button>
          <Button onClick={() => setWhole(item.incoming ?? { present: false })}>{t('accept')}</Button>
        </Space>
      )}
      {whole && (
        <div className={styles.result}>
          <h4>{t('result')}</h4>
          {whole.present ? (
            <Value value={whole.value} change={(value) => setWhole({ present: true, value })} />
          ) : (
            <em>{t('absent')}</em>
          )}
        </div>
      )}
      {!readOnly && (item.comparison.conflicts.length > 0 || whole) && (
        <Space>
          <Button type="primary" loading={busy} disabled={!dirty} onClick={() => void save()}>
            {t('save')}
          </Button>
          <Button
            disabled={busy || !dirty}
            onClick={() => {
              setDraft(item.decisions);
              setWhole(undefined);
            }}
          >
            {t('discard')}
          </Button>
        </Space>
      )}
      {dirty && <Alert type="warning" title={t('unsaved')} />}
    </div>
  );
}

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
  React.useEffect(() => {
    if (!open) return;
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
  }, [dataset, open, refresh, headword]);
  React.useEffect(() => {
    if (!open || !selected) return;
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
  }, [dataset, open, selected, page, category, search, refresh]);
  const prepare = async (source: string, allowTwoWay = false) => {
    setBusy(true);
    setError(undefined);
    const result = await ReconciliationApi.prepare(dataset, source, allowTwoWay);
    setBusy(false);
    if ('error' in result) setError(errorText(result.message));
    else {
      setSelected(result.id);
      setPage(1);
      setRefresh((n) => n + 1);
    }
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
    setBusy(true);
    setError(undefined);
    const result = apply
      ? await ReconciliationApi.apply(dataset, selected)
      : await ReconciliationApi.cancel(dataset, selected);
    setBusy(false);
    if ('error' in result) setError(errorText(result.message));
    else {
      setRefresh((n) => n + 1);
      if (apply) onApplied?.();
    }
  };
  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          if (initialPlan) setSelected(initialPlan);
        }}
      >
        {t(initialPlan ? 'review' : 'title')}
      </Button>
      <Modal
        open={open}
        title={`${t('title')} · ${dataset}`}
        width={1200}
        onCancel={() => {
          if (!dirty) setOpen(false);
        }}
        footer={null}
      >
        <div className={styles.review}>
          {dirty && <Alert type="warning" title={t('unsaved')} />}
          {error && <Alert type="error" title={error} closable onClose={() => setError(undefined)} />}
          <Typography.Paragraph>{t('hint')}</Typography.Paragraph>
          <Space wrap>
            {index.parents
              .filter((parent) => !headword && parent.source !== dataset)
              .map((parent) => (
                <Button
                  disabled={dirty}
                  loading={busy}
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
                disabled={dirty || busy}
                aria-label={t('merge_source')}
                placeholder={t('merge_source')}
                value={mergeSource}
                onChange={setMergeSource}
                options={index.sources?.map((source) => ({ value: source.name, label: source.title }))}
              />
              <Switch
                checked={twoWay}
                onChange={setTwoWay}
                disabled={dirty || busy}
                aria-label={t('two_way')}
              />
              <Typography.Text>{t('two_way')}</Typography.Text>
              <Button
                disabled={!mergeSource || dirty || busy}
                onClick={() => mergeSource && void prepare(mergeSource, twoWay)}
              >
                {t('prepare')}
              </Button>
            </Space>
          )}
          <Select
            disabled={dirty || busy}
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
          {summary && (
            <>
              {summary.status === 'review' && summary.baseline_available === false && (
                <Alert type="warning" title={t('legacy_review')} />
              )}
              {summary.status === 'review' && summary.incoming_complete === false && (
                <Alert type="info" title={t('partial')} />
              )}
              <Space wrap>
                {(['added', 'deleted', 'changed', 'conflicts'] as const).map((key) => (
                  <Button
                    disabled={dirty}
                    type={category === key ? 'primary' : 'default'}
                    key={key}
                    onClick={() => {
                      setCategory(key);
                      setPage(1);
                    }}
                  >
                    {t(key)}: {summary.counts[key]}
                  </Button>
                ))}
                <Button
                  disabled={dirty}
                  onClick={() => {
                    setCategory(undefined);
                    setPage(1);
                  }}
                >
                  {t('all')}
                </Button>
              </Space>
              <Typography.Text>
                {t('resolved', {
                  count: summary.resolved_articles,
                  total: summary.counts.conflicts,
                  remaining: summary.remaining_conflicts,
                })}
              </Typography.Text>
              <Typography.Text>
                {t(summary.status === 'applied' ? 'actual' : 'proposed', summary.proposed)}
              </Typography.Text>
              <Input.Search
                disabled={dirty}
                aria-label={t('search')}
                placeholder={t('search')}
                onSearch={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
              <Space>
                <Button disabled={dirty || busy || !items.length} onClick={() => navigate(-1)}>
                  {t('previous')}
                </Button>
                <Button disabled={dirty || busy || !items.length} onClick={() => navigate(1)}>
                  {t('next')}
                </Button>
              </Space>
              <Collapse
                destroyOnHidden
                accordion
                activeKey={expanded}
                onChange={(keys) => {
                  if (!dirty) setExpanded(keys);
                }}
                items={items.map((item) => ({
                  key: item.headword,
                  label: `${item.headword} · ${t(item.category)}${item.remaining ? ` (${item.remaining})` : ''}`,
                  children: (
                    <ReviewItem
                      onDirty={setDirty}
                      item={item}
                      dataset={dataset}
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
              {summary.status === 'review' && (
                <Space>
                  <Button
                    type="primary"
                    loading={busy}
                    disabled={dirty || summary.remaining_conflicts > 0}
                    onClick={() => void finish(true)}
                  >
                    {t('apply')}
                  </Button>
                  <Button disabled={busy || dirty} onClick={() => void finish(false)}>
                    {t('cancel')}
                  </Button>
                </Space>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
