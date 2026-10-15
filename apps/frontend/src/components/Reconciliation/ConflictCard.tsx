import React from 'react';
import { Alert, Button, Space, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import type {
  ReconciliationConflictT,
  ReconciliationDecisionT,
  ReconciliationItemT,
} from 'server/types/reconciliation';
import { Value, sideValue, opaque, contextTitle, recordOptions, useFieldLabel } from './Value';
import { VersionPanel } from './VersionPanel';
import styles from './styles.module.scss';

export function ConflictCard({
  conflict,
  index,
  item,
  decision,
  dataset,
  source,
  readOnly,
  select,
}: {
  conflict: ReconciliationConflictT;
  index: number;
  item: ReconciliationItemT;
  decision?: ReconciliationDecisionT;
  dataset: string;
  source: string;
  readOnly: boolean;
  select: (decision: ReconciliationDecisionT) => void;
}) {
  const t = useTranslations('reconciliation');
  const fieldLabel = useFieldLabel();
  const titleId = React.useId();
  const path = conflict.path.filter((part) => !opaque(part) && part !== 'parts' && part !== 'common');
  const title = path.length ? fieldLabel(path.at(-1)!) : t('whole_article');
  const context = contextTitle(item.local, conflict.path) || contextTitle(item.incoming, conflict.path);
  const saved = decision && item.decisions.some((row) => JSON.stringify(row) === JSON.stringify(decision));
  const result =
    decision?.choice === 'custom'
      ? decision.result
      : decision?.choice === 'incoming'
        ? conflict.incoming
        : conflict.local;
  return (
    <section
      className={styles.conflict}
      data-state={saved ? 'saved' : decision ? 'selected' : 'pending'}
      aria-labelledby={titleId}
    >
      <header className={styles.conflictHeader}>
        <span className={styles.conflictNumber} aria-hidden="true">
          {index + 1}
        </span>
        <div className={styles.fieldHeading}>
          {path.length > 1 && (
            <div className={styles.fieldPath}>{path.slice(0, -1).map(fieldLabel).join(' / ')}</div>
          )}
          <h3 id={titleId}>{title}</h3>
          {context && (
            <div className={styles.fieldContext} dir="auto">
              {context}
            </div>
          )}
        </div>
        <Tag color={saved ? 'success' : decision ? 'processing' : 'warning'}>
          {t(saved ? 'decision_saved' : decision ? 'decision_pending' : 'needs_decision')}
        </Tag>
      </header>
      {conflict.targets && (
        <Alert type="warning" showIcon title={t('dependencies', { targets: conflict.targets.join(', ') })} />
      )}
      <div className={styles.baseline}>
        <strong>{t('baseline')}</strong>
        <div>{sideValue(conflict.baseline, t('absent'), conflict.path)}</div>
      </div>
      <div className={styles.versions}>
        {(['local', 'incoming'] as const).map((side) => (
          <VersionPanel
            key={side}
            side={side}
            name={side === 'local' ? dataset : source}
            value={conflict[side]}
            path={conflict.path}
            selected={decision?.choice === side}
            removed={conflict.baseline.present}
            {...(!readOnly && { choose: () => select({ path: conflict.path, choice: side }) })}
          />
        ))}
      </div>
      <div className={styles.result} data-empty={!decision || undefined} role="region" aria-label={t('result')}>
        <div className={styles.resultHeader}>
          <strong>
            {decision && <span aria-hidden="true">✓ </span>}
            {t('result')}
          </strong>
          {!readOnly && (
            <Button
              size="small"
              aria-pressed={decision?.choice === 'custom'}
              onClick={() =>
                select({
                  path: conflict.path,
                  choice: 'custom',
                  result: result?.present ? result : conflict.incoming,
                })
              }
            >
              {t('edit')}
            </Button>
          )}
        </div>
        {!decision ? (
          <p className={styles.resultHint}>{t(readOnly ? 'needs_decision' : 'choose_result')}</p>
        ) : result?.present ? (
          <Value
            value={result.value}
            path={conflict.path}
            {...(!readOnly &&
              decision.choice === 'custom' && {
                change: (value) =>
                  select({ path: conflict.path, choice: 'custom', result: { present: true, value } }),
              })}
          />
        ) : (
          <p className={styles.deletionResult}>{t('result_deleted')}</p>
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
      </div>
    </section>
  );
}
