import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DOC_PAGES, DOC_SECTIONS, docTitle } from '@/content/registry';
import { localeAlternates, pageMeta } from '@/core/site';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from './docs.module.scss';

export const generateMetadata = async ({ params }: LocaleParamsP): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'docs' });

  return { ...pageMeta(t('title'), t('intro')), alternates: localeAlternates(locale, '/docs') };
};

export default async function DocsIndexPage({ params }: LocaleParamsP) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('docs');

  return (
    <div className={styles.index}>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <div className={styles.sections}>
        {DOC_SECTIONS.map((section) => (
          <div key={section} className={styles.card}>
            <h2>{t(`sections.${section}`)}</h2>
            <ul>
              {DOC_PAGES.filter((page) => page.section === section).map((page) => (
                <li key={page.slug}>
                  <Link href={`/docs/${page.slug}`}>{docTitle(page, locale)}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
