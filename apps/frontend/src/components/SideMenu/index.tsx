'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import styles from './styles.module.scss';

export const SideMenu = () => {
  const t = useTranslations('menu');
  return (
    <div className={styles.sideMenu}>
      <h3>{t('menu_title')}</h3>
      <div className={styles.menuItems}>
        <Link href="/">{t('main')}</Link>
      </div>
    </div>
  );
};
