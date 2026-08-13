import { getTranslations } from 'next-intl/server';
import { Breadcrumb, Card, Statistic } from 'antd';
import { EnStatisticsT, WordLevelE } from 'server/types';
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

export default async function CommonStatisticsPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const statsT = await getTranslations('statistics');
  const stats = await ServerEnApi.getStatistics();

  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/statistics`, title: t('statistics') },
    { title: statsT('common_statistics') },
  ];

  if ('error' in stats) {
    return (
      <div className={styles.mainPage}>
        <StatisticsError locale={locale} message={stats.message} />
      </div>
    );
  }

  const { totals, coverage, by_part_of_speech, by_word_level } = stats as EnStatisticsT;
  const totalCards: { key: string; value: number }[] = [
    { key: 'entries', value: totals.entries },
    { key: 'words', value: totals.words },
    { key: 'phrases', value: totals.phrases },
    { key: 'grammar_patterns', value: totals.grammar_patterns },
    { key: 'word_forms', value: totals.word_forms },
    { key: 'meanings', value: totals.meanings },
    { key: 'meaning_translations', value: totals.meaning_translations },
    { key: 'short_translations', value: totals.short_translations },
  ];
  const coverageCards: { key: string; value: number; percentOfWords?: number }[] = [
    {
      key: 'words_with_meanings',
      value: coverage.words_with_meanings,
      percentOfWords: percentOf(coverage.words_with_meanings, totals.words),
    },
    {
      key: 'words_with_short_translations',
      value: coverage.words_with_short_translations,
      percentOfWords: percentOf(coverage.words_with_short_translations, totals.words),
    },
    { key: 'generated_words', value: coverage.generated_words },
    { key: 'obsolete_words', value: coverage.obsolete_words },
    { key: 'phrasal_verbs', value: coverage.phrasal_verbs },
  ];

  const posTotal = by_part_of_speech.reduce((sum, r) => sum + r.count, 0);
  const sortedLevels = [...by_word_level].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.word_level) - LEVEL_ORDER.indexOf(b.word_level),
  );

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{statsT('common_statistics')}</Title>
      <Breadcrumb items={breadCrumbs} />

      <div className={styles.cardsGrid}>
        {totalCards.map((c) => (
          <Card key={c.key} size="small">
            <Statistic title={statsT(c.key)} value={c.value} />
          </Card>
        ))}
      </div>

      <Title level={4}>{statsT('coverage')}</Title>
      <div className={styles.cardsGrid}>
        {coverageCards.map((c) => (
          <Card key={c.key} size="small">
            <Statistic
              title={statsT(c.key)}
              value={c.value}
              suffix={
                c.percentOfWords !== undefined ? (
                  <span className={styles.percentSuffix}>({c.percentOfWords.toFixed(1)}%)</span>
                ) : undefined
              }
            />
          </Card>
        ))}
      </div>

      <div className={styles.distributions}>
        <Card title={statsT('by_part_of_speech')}>
          {by_part_of_speech.map((r) => (
            <DistributionRow key={r.part_of_speech} label={r.part_of_speech} count={r.count} total={posTotal} />
          ))}
        </Card>
        <Card title={statsT('by_word_level')}>
          {sortedLevels.map((r) => (
            <DistributionRow
              key={r.word_level ?? 'unspecified'}
              label={r.word_level ?? statsT('level_unspecified')}
              count={r.count}
              total={totals.words}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
