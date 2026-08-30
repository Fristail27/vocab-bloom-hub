'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

import styles from './styles.module.scss';

/** The same page in the other locale */
export const LanguageSwitch = () => {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <span className={styles.switch} aria-label={t('language')}>
      {routing.locales.map((candidate) => (
        <Link
          key={candidate}
          href={pathname}
          locale={candidate}
          className={candidate === locale ? styles.active : undefined}
          aria-current={candidate === locale ? 'true' : undefined}
        >
          {candidate}
        </Link>
      ))}
    </span>
  );
};
