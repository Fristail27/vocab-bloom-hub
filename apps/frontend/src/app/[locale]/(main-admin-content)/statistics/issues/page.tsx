import { getTranslations } from 'next-intl/server';
import { Breadcrumb, Card } from 'antd';
import { EnIssuesStatisticsT } from 'server/types';
import { Title } from '@/core/ui/Title';
import { Icon } from '@/core/ui/Icon';
import { ServerEnApi } from '@/core/api/EnApi/ServerEnApi';
import { CommonPageP } from '@/types/common';
import { DistributionRow } from '../_components/DistributionRow';
import { StatisticsError } from '../_components/StatisticsError';
import styles from './styles.module.scss';

export default async function IssuesStatisticsPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const statsT = await getTranslations('statistics');
  const stats = await ServerEnApi.getIssuesStatistics();

  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/statistics`, title: t('statistics') },
    { title: statsT('issues_statistics') },
  ];

  if ('error' in stats) {
    return (
      <div className={styles.mainPage}>
        <StatisticsError locale={locale} message={stats.message} />
      </div>
    );
  }

  const { issues } = stats as EnIssuesStatisticsT;

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{statsT('issues_statistics')}</Title>
      <Breadcrumb items={breadCrumbs} />
      <Card title={statsT('issues_title')}>
        {issues.map((issue) => (
          <DistributionRow
            key={issue.key}
            label={statsT(issue.key)}
            count={issue.count}
            total={issue.total}
            showPercent
          />
        ))}
      </Card>
    </div>
  );
}
