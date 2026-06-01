import { getTranslations } from 'next-intl/server';
import { Title } from '@/core/ui/Title';
import { MainSection } from './_components/MainSection';
import { getManagingButtons, getStatisticsButtons } from '@/app/[locale]/(main-admin-content)/utils';
import { CommonPageP } from '@/types/common';
import styles from './styles.module.scss';

export default async function HomePage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const manageT = await getTranslations('managing');
  const statisticsT = await getTranslations('statistics');
  const managingButtons = getManagingButtons(manageT, locale);
  const statisticsTButtons = getStatisticsButtons(statisticsT, locale);

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('main')}</Title>
      <MainSection title={t('managing')} buttons={managingButtons} />
      <MainSection title={t('statistics')} buttons={statisticsTButtons} />
    </div>
  );
}
