import { getTranslations } from 'next-intl/server';
import { Breadcrumb } from 'antd';
import { Title } from '@/core/ui/Title';
import { CommonPageP } from '@/types/common';
import { DatasetStatistics } from './DatasetStatistics';
import styles from '../styles.module.scss';

export default async function DatasetsStatisticsPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('statistics');
  const menu = await getTranslations('menu');
  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('all_datasets')}</Title>
      <Breadcrumb
        items={[{ href: `/${locale}/statistics`, title: menu('statistics') }, { title: t('all_datasets') }]}
      />
      <DatasetStatistics />
    </div>
  );
}
