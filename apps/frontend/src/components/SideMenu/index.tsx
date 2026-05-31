'use client';

import { useTranslations } from 'next-intl';
import { Typography } from 'antd';
import { DictionarySwitcher } from '@/components/DictionarySwitcher';
import styles from './styles.module.scss';

const { Title, Link } = Typography;

export const SideMenu = () => {
  const t = useTranslations('menu');
  return (
    <div className={styles.sideMenu}>
      <div className={styles.menuContent}>
        <div className={styles.topPart}>
          <Title level={4}>{t('menu_title')}</Title>
          <div className={styles.menuItems}>
            <Link href="/">{t('main')}</Link>
          </div>
        </div>
        <DictionarySwitcher />
      </div>
    </div>
  );
};
