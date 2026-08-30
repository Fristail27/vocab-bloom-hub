import React from 'react';
import { getTranslations } from 'next-intl/server';

import { LanguageSwitch } from '@/components/LanguageSwitch';
import { REPO_URL } from '@/content/repo';
import { Link } from '@/i18n/navigation';

import styles from './styles.module.scss';

export const Header = async () => {
  const t = await getTranslations('nav');

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing to optimize */}
          <img src="/logo.svg" alt="" width={28} height={28} />
          <span>Vocab Bloom Hub</span>
        </Link>
        <nav className={styles.nav}>
          <Link href="/docs">{t('docs')}</Link>
          <Link href="/api">{t('api')}</Link>
          <Link href="/playground">{t('playground')}</Link>
          <Link href="/word">{t('words')}</Link>
          <Link href="/docs/sdk/node">{t('sdk')}</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {t('github')}
          </a>
          <LanguageSwitch />
        </nav>
      </div>
    </header>
  );
};
