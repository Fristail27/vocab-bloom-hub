import { getTranslations } from 'next-intl/server';
import { Title } from '@/core/ui/Title';
import { SettingsSection } from './_components/SettingsSection';
import styles from './styles.module.scss';

export default async function SettingsPage() {
  const t = await getTranslations('menu');
  const settingsT = await getTranslations('settings_page');

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('settings')}</Title>
      <p className={styles.intro}>{settingsT('intro')}</p>
      <SettingsSection />
    </div>
  );
}
