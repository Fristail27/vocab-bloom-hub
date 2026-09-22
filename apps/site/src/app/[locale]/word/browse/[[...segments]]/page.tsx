import React from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { WordSearch } from '@/components/WordSearch';
import {
  browsePage,
  browsePath,
  BrowsePageT,
  bucketSummaries,
  isBucket,
  OTHER_BUCKET,
  parsePage,
} from '@/core/browse';
import { DictionaryUnavailableError } from '@/core/dictionary';
import { FIRST_WALK_WAIT_MS, HeadwordIndexT, headwordIndex } from '@/core/headwords';
import { pageMeta } from '@/core/site';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from '../../word.module.scss';

// The browse index over every headword (issue #480): /word/browse lists the
// letters, /word/browse/<letter> the words starting with it, 200 a page,
// /word/browse/<letter>/<page> the further pages. One optional catch-all so
// the three shapes share the on-demand regeneration of the word pages:
// nothing is known at build time, a page is rendered when first asked for
// from the process's headword index and kept for an hour
export const revalidate = 3600;
export const generateStaticParams = () => [];

type BrowseP = LocaleParamsP<{ segments?: string[] }>;

type TranslateT = Awaited<ReturnType<typeof getTranslations>>;

// what the URL asks for; `null` is a 404
type RequestT = { kind: 'index' } | { kind: 'letter'; bucket: string; page: number } | null;

const parseRequest = (segments: string[] | undefined): RequestT => {
  const [bucket, page, ...rest] = segments ?? [];
  if (bucket === undefined) return { kind: 'index' };
  if (rest.length > 0 || !isBucket(bucket)) return null;
  const number = parsePage(page);
  return number === null ? null : { kind: 'letter', bucket, page: number };
};

const letterLabel = (bucket: string, t: TranslateT): string =>
  bucket === OTHER_BUCKET ? t('browse_other') : bucket.toUpperCase();

const letterTitle = (result: BrowsePageT, t: TranslateT): string => {
  const letter = t('browse_letter_title', { letter: letterLabel(result.bucket, t) });
  return result.pages > 1
    ? `${letter} — ${t('browse_page', { page: result.page, pages: result.pages })}`
    : letter;
};

// the first page has one URL: /word/browse/a, not /word/browse/a/1
const canonicalOrRedirect = (locale: string, request: RequestT, segments: string[] | undefined): void => {
  if (request?.kind === 'letter' && request.page === 1 && segments?.length === 2) {
    permanentRedirect(`/${locale}${browsePath(request.bucket)}`);
  }
};

const indexOrThrow = async (): Promise<HeadwordIndexT> => {
  // no index yet (the walk is running, or the API is down): an error, not a
  // page — a render that failed is not kept, nothing thin gets indexed
  const index = await headwordIndex.get({ waitMs: FIRST_WALK_WAIT_MS });
  if (!index) throw new DictionaryUnavailableError();
  return index;
};

export const generateMetadata = async ({ params }: BrowseP): Promise<Metadata> => {
  const { locale, segments } = await params;
  const request = parseRequest(segments);
  if (!request) return {};
  canonicalOrRedirect(locale, request, segments);
  const t = await getTranslations({ locale, namespace: 'word' });
  const index = await indexOrThrow();
  if (request.kind === 'index') {
    return pageMeta({
      locale,
      path: '/word/browse',
      title: t('browse_title'),
      description: t('browse_intro', { count: index.words.length }),
    });
  }
  const result = browsePage(index, request.bucket, request.page);
  if (!result) return {};
  return pageMeta({
    locale,
    path: browsePath(result.bucket, result.page),
    title: letterTitle(result, t),
    description: t('browse_intro', { count: result.count }),
  });
};

const BrowseIndex = ({ index, t }: { index: HeadwordIndexT; t: TranslateT }) => (
  <div className={`container ${styles.page}`}>
    <h1>{t('browse_title')}</h1>
    <p className={styles.intro}>{t('browse_intro', { count: index.words.length })}</p>
    <ul className={styles.letters}>
      {bucketSummaries(index).map(({ bucket, count }) => (
        <li key={bucket}>
          <Link href={browsePath(bucket)}>
            <span className={styles.letter}>{bucket === OTHER_BUCKET ? t('browse_other') : bucket}</span>
            <small>{count}</small>
          </Link>
        </li>
      ))}
    </ul>
    <WordSearch />
  </div>
);

const BrowseLetter = ({ result, t }: { result: BrowsePageT; t: TranslateT }) => {
  const pager = (
    <nav className={styles.pager} aria-label={t('browse_page', { page: result.page, pages: result.pages })}>
      {result.page > 1 ? (
        <Link href={browsePath(result.bucket, result.page - 1)}>← {t('browse_prev')}</Link>
      ) : (
        <span />
      )}
      <span>{t('browse_page', { page: result.page, pages: result.pages })}</span>
      {result.page < result.pages ? (
        <Link href={browsePath(result.bucket, result.page + 1)}>{t('browse_next')} →</Link>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <div className={`container ${styles.page}`}>
      <p className={styles.crumbs}>
        <Link href="/word">{t('index_title')}</Link> · <Link href="/word/browse">{t('browse_title')}</Link>
      </p>
      <h1>{t('browse_letter_title', { letter: letterLabel(result.bucket, t) })}</h1>
      {result.pages > 1 && pager}
      <ul className={styles.browseList}>
        {result.words.map((word) => (
          <li key={word}>
            <Link href={`/word/${encodeURIComponent(word)}`}>{word}</Link>
          </li>
        ))}
      </ul>
      {result.pages > 1 && pager}
    </div>
  );
};

export default async function BrowsePage({ params }: BrowseP) {
  const { locale, segments } = await params;
  const request = parseRequest(segments);
  if (!request) notFound();
  canonicalOrRedirect(locale, request, segments);
  setRequestLocale(locale);
  const t = await getTranslations('word');
  const index = await indexOrThrow();
  if (request.kind === 'index') return <BrowseIndex index={index} t={t} />;
  const result = browsePage(index, request.bucket, request.page);
  if (!result) notFound();
  return <BrowseLetter result={result} t={t} />;
}
