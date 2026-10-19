import { Suspense } from 'react';
import { IssuesBrowser } from './IssuesBrowser';
import { getTranslations } from 'next-intl/server';
import { Breadcrumb } from 'antd';
import { Title } from '@/core/ui/Title';
import { Icon } from '@/core/ui/Icon';
import { CommonPageP } from '@/types/common';
import styles from './styles.module.scss';

export default async function IssuesStatisticsPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const statsT = await getTranslations('statistics');

  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/statistics`, title: t('statistics') },
    { title: statsT('issues_statistics') },
  ];

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{statsT('issues_statistics')}</Title>
      <Breadcrumb items={breadCrumbs} />
      <Suspense fallback={null}>
        <IssuesBrowser />
      </Suspense>
    </div>
  );
}
