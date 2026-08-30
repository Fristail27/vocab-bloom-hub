import { getTranslations } from 'next-intl/server';
import { Title } from '@/core/ui/Title';
import { HistorySection } from './_components/HistorySection';
import styles from './styles.module.scss';

export default async function HistoryPage() {
  const t = await getTranslations('menu');
  const historyT = await getTranslations('history');

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('history')}</Title>
      <p className={styles.intro}>{historyT('intro')}</p>
      <HistorySection />
    </div>
  );
}
