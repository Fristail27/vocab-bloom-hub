import { getTranslations } from 'next-intl/server';
import { Title } from '@/core/ui/Title';
import { CommonPageP } from '@/types/common';
import { MainSection } from '../_components/MainSection';
import { getDocumentationButtons } from '../utils';
import styles from './styles.module.scss';

export default async function DocumentationPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const docsT = await getTranslations('documentation');
  const buttons = getDocumentationButtons(docsT, locale);

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('documentation')}</Title>
      <p className={styles.intro}>{docsT('intro')}</p>
      <MainSection title={docsT('public_endpoints')} buttons={buttons} />
    </div>
  );
}
