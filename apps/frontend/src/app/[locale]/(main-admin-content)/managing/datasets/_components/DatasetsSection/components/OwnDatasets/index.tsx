'use client';

import React from 'react';
import { Button, Empty, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DatasetT } from 'server/types';
import styles from './styles.module.scss';

const { Paragraph, Title } = Typography;

type OwnDatasetsP = {
  datasets: DatasetT[];
  /** false on SQLite: nothing can be created */
  supported: boolean;
  onCreate: () => void;
  /** The card of a dataset, the one every dataset of the page has */
  renderCard: (dataset: DatasetT) => React.ReactNode;
};

/**
 * The datasets of the instance's own (issue #540), under the cards of the
 * catalog: created empty by the admin under a license they choose, filled
 * through the switch of the dataset that is edited or by an import, served
 * once activated. Their terms are the owner's and can be corrected.
 */
export const OwnDatasets: React.FC<OwnDatasetsP> = ({ datasets, supported, onCreate, renderCard }) => {
  const t = useTranslations('datasets');

  return (
    <section className={styles.own} data-testid="own-datasets">
      <div className={styles.header}>
        <Title level={3}>{t('own_title')}</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!supported}
          onClick={onCreate}
          data-testid="own-dataset-create"
        >
          {t('own_create_button')}
        </Button>
      </div>
      <Paragraph type="secondary">{t('own_intro')}</Paragraph>
      {datasets.length ? datasets.map(renderCard) : <Empty description={t('own_empty')} />}
    </section>
  );
};
