'use client';

import React from 'react';
import { Select, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { useEditedDataset } from './index';
import styles from './styles.module.scss';

/**
 * The switch of the dataset that is edited, in the header of the admin UI
 * (issue #540): every dataset the instance holds, the active one marked.
 * Adding and editing words, the search, the lists, the statistics, the
 * history of edits and the queue of suggestions work on the one it names.
 */
export const DatasetSwitch: React.FC = () => {
  const t = useTranslations('edited_dataset');
  const { datasets, edited, choose } = useEditedDataset();
  if (!datasets.length || !edited) return null;

  return (
    <Select<string>
      className={styles.switch}
      value={edited.name}
      onChange={choose}
      aria-label={t('switch')}
      prefix={<span className={styles.prefix}>{t('switch_prefix')}</span>}
      popupMatchSelectWidth={false}
      data-testid="dataset-switch"
      options={datasets.map((dataset) => ({
        value: dataset.name,
        label: (
          <span className={styles.option}>
            <span className={styles.optionTitle}>{dataset.title}</span>
            {dataset.active && <Tag color="green">{t('active')}</Tag>}
          </span>
        ),
      }))}
    />
  );
};
