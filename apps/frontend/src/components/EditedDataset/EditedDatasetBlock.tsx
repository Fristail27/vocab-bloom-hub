'use client';

import React from 'react';
import { Alert, Tag, Typography } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { isPublicSourceDataset } from 'server/core/constants/dataset_catalog';
import { findStandardLicense } from 'server/core/constants/data_licenses';
import { EnApi } from '@/core/api/EnApi';
import { useEditedDataset } from './index';
import styles from './styles.module.scss';

const { Text } = Typography;

/**
 * What the dataset that is edited is (issue #540), under the switch: its
 * title, source and license, the number of its entries, whether it is the
 * one that is served, whether it is a dataset of the catalog or the
 * owner's. A dataset of a public source is reminded of: an edit marks the
 * entry as modified, and the copy says so to its readers.
 */
export const EditedDatasetBlock: React.FC = () => {
  const locale = useLocale();
  const t = useTranslations('edited_dataset');
  const { datasets, edited } = useEditedDataset();
  const [entries, setEntries] = React.useState<number | null>(null);
  const name = edited?.name;

  React.useEffect(() => {
    if (!name) return;
    let current = true;
    setEntries(null);
    // the statistics answer from the dataset the switch names
    void EnApi.getStatistics().then((res) => {
      if (current && !('error' in res)) setEntries(res.totals.entries);
    });
    return () => {
      current = false;
    };
  }, [name]);

  if (!edited) return null;
  const active = datasets.find((dataset) => dataset.active);
  const standard = findStandardLicense(edited.license);
  const fromSource = isPublicSourceDataset(edited);

  return (
    // a region of its own, not a section: the pages below keep their first section for their content
    <div role="region" className={styles.block} aria-label={t('block')} data-testid="edited-dataset">
      <div className={styles.heading}>
        <Text type="secondary">{t('editing')}</Text>
        <Text strong>{edited.title}</Text>
        <Text type="secondary" code>
          {edited.name}
        </Text>
        {edited.active ? <Tag color="green">{t('active')}</Tag> : <Tag color="gold">{t('not_served')}</Tag>}
        <Tag color={edited.own ? 'purple' : 'default'}>{edited.own ? t('own') : t('catalog')}</Tag>
      </div>
      <dl className={styles.facts}>
        <dt>{t('source')}</dt>
        <dd>
          <Text code>{edited.source}</Text>
        </dd>
        <dt>{t('license')}</dt>
        <dd>
          <a href={edited.license_url} target="_blank" rel="license noreferrer noopener">
            {standard ? standard.spdx : edited.license}
          </a>
        </dd>
        <dt>{t('entries')}</dt>
        <dd data-testid="edited-dataset-entries">
          {entries === null ? '…' : new Intl.NumberFormat(locale).format(entries)}
        </dd>
      </dl>
      {!edited.active && active && (
        <Text type="secondary" className={styles.note}>
          {t('not_served_note', { active: active.title })}
        </Text>
      )}
      {fromSource && (
        <Alert
          type="info"
          showIcon
          className={styles.note}
          data-testid="edited-dataset-modified-note"
          title={t('public_source_note', { title: edited.title })}
        />
      )}
    </div>
  );
};
