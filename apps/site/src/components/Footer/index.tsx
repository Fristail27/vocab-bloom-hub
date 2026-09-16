import React from 'react';
import { getTranslations } from 'next-intl/server';

import { REPO_BLOB_URL, REPO_URL } from '@/content/repo';
import { SITE_VERSION } from '@/core/site';
import { Link } from '@/i18n/navigation';

import styles from './styles.module.scss';

export const Footer = async () => {
  const t = await getTranslations('footer');

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <span>{t('made_by')}</span>
        <Link href="/docs/changelog" title={t('release_notes')} data-testid="site-version">
          v{SITE_VERSION}
        </Link>
        <a href={`${REPO_BLOB_URL}/LICENSE`}>{t('code_license')}</a>
        <Link href="/docs/data-license">{t('data_license')}</Link>
        <span className={styles.spacer} />
        <a href={`${REPO_URL}/issues`}>{t('issues')}</a>
        <a href={`${REPO_URL}/discussions`}>{t('discussions')}</a>
        <a href={REPO_URL}>GitHub</a>
      </div>
    </footer>
  );
};
