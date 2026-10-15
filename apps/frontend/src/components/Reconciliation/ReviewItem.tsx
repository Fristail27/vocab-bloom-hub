import React from 'react';
import { Alert, Button, Space } from 'antd';
import { useTranslations } from 'next-intl';
import { ReconciliationApi } from '@/core/api/ReconciliationApi';
import type {
  ReconciliationItemT,
  ReconciliationSideT,
  ReconciliationDecisionT,
} from 'server/types/reconciliation';
import { Value, sideValue } from './Value';
import { ConflictCard } from './ConflictCard';
import { VersionPanel } from './VersionPanel';
import styles from './styles.module.scss';

export function ReviewItem({
  item,
  dataset,
  source,
  readOnly,
  saved,
  failed,
  onDirty,
}: {
  onDirty: (dirty: boolean) => void;
  item: ReconciliationItemT;
  dataset: string;
  source: string;
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
      {!whole &&
        item.comparison.conflicts.map((conflict, index) => (
          <ConflictCard
            key={JSON.stringify(conflict.path)}
            conflict={conflict}
            index={index}
            item={item}
            decision={draft.find((row) => JSON.stringify(row.path) === JSON.stringify(conflict.path))}
            dataset={dataset}
            source={source}
            readOnly={readOnly || busy}
            select={select}
          />
        ))}
      {!whole && item.comparison.conflicts.length === 0 && (
        <>
          <div className={styles.baseline}>
            <strong>{t('baseline')}</strong>
            <div>{sideValue(item.baseline ?? { present: false }, t('absent'))}</div>
          </div>
          <div className={styles.versions}>
            {(['local', 'incoming'] as const).map((side) => (
              <VersionPanel
                key={side}
                side={side}
                name={side === 'local' ? dataset : source}
                value={item[side] ?? { present: false }}
                removed={item.baseline?.present}
              />
            ))}
          </div>
        </>
      )}
      {!readOnly && !whole && (
        <details className={styles.wholeArticle}>
          <summary>{t('whole_article')}</summary>
          <p>{t('whole_article_hint')}</p>
          <Space wrap>
            <Button disabled={busy} onClick={() => setWhole(item.result)}>
              {t('edit_article')}
            </Button>
            <Button disabled={busy} onClick={() => setWhole(item.local ?? { present: false })}>
              {t('keep_article')}
            </Button>
            <Button disabled={busy} onClick={() => setWhole(item.incoming ?? { present: false })}>
              {t('accept_article')}
            </Button>
          </Space>
        </details>
      )}
      {whole && (
        <div className={styles.result} role="region" aria-label={t('whole_article')}>
          <div className={styles.resultHeader}>
            <strong>
              {t('whole_article')} · {t('result')}
            </strong>
            <Button disabled={busy} onClick={() => setWhole(undefined)}>
              {t('back_to_fields')}
            </Button>
          </div>
          <Alert showIcon type="warning" title={t('whole_article_hint')} />
          {whole.present ? (
            <Value
              value={whole.value}
              {...(!readOnly && !busy && { change: (value) => setWhole({ present: true, value }) })}
            />
          ) : (
            <p className={styles.deletionResult}>{t('result_deleted')}</p>
          )}
        </div>
      )}
      {!readOnly && (item.comparison.conflicts.length > 0 || whole) && (
        <div className={styles.saveBar}>
          <span className={styles.saveHint} role="status">
            {dirty ? t('decision_pending') : t('save_hint')}
          </span>
          <Space wrap>
            <Button
              disabled={busy || !dirty}
              onClick={() => {
                setDraft(item.decisions);
                setWhole(undefined);
              }}
            >
              {t('discard')}
            </Button>
            <Button type="primary" loading={busy} disabled={!dirty} onClick={() => void save()}>
              {t('save')}
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
}
