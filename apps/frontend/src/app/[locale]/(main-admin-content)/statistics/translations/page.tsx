import { getTranslations } from 'next-intl/server';
import { Breadcrumb, Card, Statistic, Table } from 'antd';
import { EnTranslationsStatisticsT, WordLevelE } from 'server/types';
import { Title } from '@/core/ui/Title';
import { Icon } from '@/core/ui/Icon';
import { ServerEnApi } from '@/core/api/EnApi/ServerEnApi';
import { CommonPageP } from '@/types/common';
import { DistributionRow, percentOf } from '../_components/DistributionRow';
import { StatisticsError } from '../_components/StatisticsError';
import styles from './styles.module.scss';

const LEVEL_ORDER: (WordLevelE | null)[] = [
  WordLevelE.A1,
  WordLevelE.A2,
  WordLevelE.B1,
  WordLevelE.B2,
  WordLevelE.C1,
  WordLevelE.C2,
  null,
];

export default async function TranslationsStatisticsPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const statsT = await getTranslations('statistics');
  const stats = await ServerEnApi.getTranslationsStatistics();

  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/statistics`, title: t('statistics') },
    { title: statsT('translations_statistics') },
  ];

  if ('error' in stats) {
    return (
      <div className={styles.mainPage}>
        <StatisticsError locale={locale} message={stats.message} />
      </div>
    );
  }

  const { totals, by_language, meanings_by_level } = stats as EnTranslationsStatisticsT;

  const sortedLevels = [...meanings_by_level].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.meaning_level) - LEVEL_ORDER.indexOf(b.meaning_level),
  );

  const languageColumns = [
    { title: statsT('language'), dataIndex: 'language', key: 'language' },
    {
      title: statsT('meaning_translations'),
      dataIndex: 'meaning_translations',
      key: 'meaning_translations',
    },
    { title: statsT('short_translations'), dataIndex: 'short_translations', key: 'short_translations' },
  ];

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{statsT('translations_statistics')}</Title>
      <Breadcrumb items={breadCrumbs} />

      <div className={styles.cardsGrid}>
        <Card size="small">
          <Statistic title={statsT('meanings')} value={totals.meanings} />
        </Card>
        <Card size="small">
          <Statistic title={statsT('meaning_translations')} value={totals.meaning_translations} />
        </Card>
        <Card size="small">
          <Statistic title={statsT('short_translations')} value={totals.short_translations} />
        </Card>
        <Card size="small">
          <Statistic
            title={statsT('meanings_without_translations')}
            value={totals.meanings_without_translations}
            suffix={
              <span className={styles.percentSuffix}>
                ({percentOf(totals.meanings_without_translations, totals.meanings).toFixed(1)}%)
              </span>
            }
          />
        </Card>
        <Card size="small">
          <Statistic title={statsT('avg_meanings_per_word')} value={totals.avg_meanings_per_word} />
        </Card>
      </div>

      <div className={styles.distributions}>
        <Card title={statsT('by_language')}>
          <Table
            rowKey="language"
            columns={languageColumns}
            dataSource={by_language.map((r) => ({
              ...r,
              language: r.language.toUpperCase(),
              meaning_translations: r.meaning_translations.toLocaleString(),
              short_translations: r.short_translations.toLocaleString(),
            }))}
            pagination={false}
            size="small"
          />
        </Card>
        <Card title={statsT('meanings_by_level')}>
          {sortedLevels.map((r) => (
            <DistributionRow
              key={r.meaning_level ?? 'unspecified'}
              label={r.meaning_level ?? statsT('level_unspecified')}
              count={r.count}
              total={totals.meanings}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
