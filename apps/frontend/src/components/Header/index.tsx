import React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { DatasetSwitch } from '@/components/EditedDataset/DatasetSwitch';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { MainLogoWithTitle } from '@/core/ui/logo';
import styles from './styles.module.scss';

export const Header: React.FC = () => {
  const t = useTranslations('header');
  const locale = useLocale();

  return (
    <header className={styles.header}>
      <Link className={styles.home} href={`/${locale}`} aria-label={t('home')}>
        <MainLogoWithTitle width={280} height={60} />
      </Link>
      <div className={styles.rightPart}>
        {/* the dataset that is edited (issue #540); nothing without a session */}
        <DatasetSwitch />
        <ThemeSwitch label={t('theme')} />
        <LanguageSwitch label={t('language')} />
      </div>
    </header>
  );
};
