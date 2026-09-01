import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { WordSearch } from '@/components/WordSearch';
import { EXAMPLE_WORDS } from '@/content/words';
import { localeAlternates, pageMeta } from '@/core/site';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from './word.module.scss';

export const generateMetadata = async ({ params }: LocaleParamsP): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'word' });

  return { ...pageMeta(t('index_title'), t('index_intro')), alternates: localeAlternates(locale, '/word') };
};

export default async function WordIndexPage({ params }: LocaleParamsP) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('word');

  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('index_title')}</h1>
      <p className={styles.intro}>{t('index_intro')}</p>
      <WordSearch />
      <div className={styles.section}>
        <h2>{t('examples_title')}</h2>
        <ul className={styles.examples}>
          {EXAMPLE_WORDS.map((word) => (
            <li key={word}>
              <Link href={`/word/${encodeURIComponent(word)}`}>{word}</Link>
            </li>
          ))}
          <li>
            <a href={`/${locale}/word/random`}>{t('random')} →</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
