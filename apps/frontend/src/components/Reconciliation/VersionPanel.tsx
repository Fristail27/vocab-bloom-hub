import React from 'react';
import { Button, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import type { ReconciliationSideT } from 'server/types/reconciliation';
import { sideValue } from './Value';
import styles from './styles.module.scss';

/** Keep each decision beside the version it selects, including explicit deletions. */
export function VersionPanel({
  side,
  value,
  name,
  path,
  selected,
  removed,
  choose,
}: {
  side: 'local' | 'incoming';
  value: ReconciliationSideT;
  name: string;
  path?: string[];
  selected?: boolean;
  removed?: boolean;
  choose?: () => void;
}) {
  const t = useTranslations('reconciliation');
  return (
    <div className={styles.version} data-side={side} data-selected={selected || undefined}>
      <div className={styles.versionHeader}>
        <div>
          <strong>{t(side)}</strong>
          <span className={styles.sourceName} dir="auto">
            {name}
          </span>
        </div>
        {selected && <Tag color="success">{t('selected')}</Tag>}
      </div>
      <div className={styles.versionBody}>
        {value.present ? (
          sideValue(value, t('absent'), path)
        ) : (
          <div className={styles.absent} data-removed={removed || undefined}>
            <span aria-hidden="true">{removed ? '−' : '∅'}</span>
            {t(removed ? 'deleted_value' : 'absent')}
          </div>
        )}
      </div>
      {choose && (
        <div className={styles.versionAction}>
          <Button block aria-pressed={Boolean(selected)} onClick={choose}>
            {selected && <span aria-hidden="true">✓ </span>}
            {t(side === 'local' ? 'keep' : 'accept')}
          </Button>
        </div>
      )}
    </div>
  );
}
