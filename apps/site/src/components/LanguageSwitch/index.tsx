'use client';

import React, { Suspense } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

import styles from './styles.module.scss';

/** The locale links for `pathname`, carrying `q` when the page has that query. */
const LocaleLinks: React.FC<{ pathname: string; query: string | null }> = ({ pathname, query }) => {
  const locale = useLocale();
  const t = useTranslations('nav');

  return (
    <span className={styles.switch} aria-label={t('language')}>
      {routing.locales.map((candidate) => (
        <Link
          key={candidate}
          // The object form keeps the encoding; building the query string here
          // would double encode a term with a space or a non-ASCII character.
          href={query ? { pathname, query: { q: query } } : pathname}
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

/**
 * Reads the live search params. The word search writes its query with
 * history.replaceState after the page loads, so a link built from usePathname()
 * alone carried the bare path and both the query and its results were dropped on
 * a locale switch (issue #546).
 */
const LanguageSwitchWithQuery: React.FC<{ pathname: string }> = ({ pathname }) => {
  const q = useSearchParams().get('q');
  return <LocaleLinks pathname={pathname} query={q} />;
};

/** The same page in the other locale */
export const LanguageSwitch = () => {
  const pathname = usePathname();

  // useSearchParams takes the tree out of static rendering and this switch sits
  // in the header of every page, so the boundary lives here: without it no
  // locale of any page can be prerendered and the build fails. The fallback is
  // the same links without the query, which is what the page had before.
  return (
    <Suspense fallback={<LocaleLinks pathname={pathname} query={null} />}>
      <LanguageSwitchWithQuery pathname={pathname} />
    </Suspense>
  );
};
