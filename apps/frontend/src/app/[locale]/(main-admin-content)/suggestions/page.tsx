import { getTranslations } from 'next-intl/server';
import { Title } from '@/core/ui/Title';
import { SuggestionsSection } from './_components/SuggestionsSection';
import styles from './styles.module.scss';

export default async function SuggestionsPage() {
  const t = await getTranslations('menu');
  const suggestionsT = await getTranslations('suggestions');

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('suggestions')}</Title>
      <p className={styles.intro}>{suggestionsT('intro')}</p>
      <SuggestionsSection />
    </div>
  );
}
