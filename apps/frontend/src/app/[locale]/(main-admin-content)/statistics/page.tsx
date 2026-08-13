import { getTranslations } from 'next-intl/server';
import { Title } from '@/core/ui/Title';
import { MainSection } from '../_components/MainSection';
import { CommonPageP } from '@/types/common';
import { getStatisticsButtons } from '../utils';
import styles from './styles.module.scss';

export default async function StatisticsPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const statsT = await getTranslations('statistics');
  const buttons = getStatisticsButtons(statsT, locale);

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('statistics')}</Title>
      <MainSection title={t('statistics')} buttons={buttons} />
    </div>
  );
}
