import { getTranslations } from 'next-intl/server';
import { Title } from '@/core/ui/Title';
import styles from './styles.module.scss';

export default async function StatisticsPage() {
  const t = await getTranslations('menu');

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('statistics')}</Title>
    </div>
  );
}
