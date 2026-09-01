import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Markdown } from '@/components/Markdown';
import { Toc } from '@/components/Toc';
import { renderMarkdown } from '@/content/markdown';
import { DOC_PAGES, docFile, docTitle, findDocBySlug } from '@/content/registry';
import { readRepoFile, REPO_BLOB_URL } from '@/content/repo';
import { localeAlternates, pageMeta } from '@/core/site';
import { routing } from '@/i18n/routing';
import { InterfaceLanguageEnum, LocaleParamsP } from '@/types/common';

import styles from '../docs.module.scss';

type DocPageP = LocaleParamsP<{ slug: string[] }>;

// every documented file, in every locale, rendered at build time
export const generateStaticParams = () =>
  routing.locales.flatMap((locale) => DOC_PAGES.map((page) => ({ locale, slug: page.slug.split('/') })));

export const dynamicParams = false;

export const generateMetadata = async ({ params }: DocPageP): Promise<Metadata> => {
  const { locale, slug } = await params;
  const page = findDocBySlug(slug.join('/'));

  return page
    ? { ...pageMeta(docTitle(page, locale)), alternates: localeAlternates(locale, `/docs/${page.slug}`) }
    : {};
};

export default async function DocPage({ params }: DocPageP) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = findDocBySlug(slug.join('/'));
  if (!page) notFound();

  const t = await getTranslations('docs');
  const file = docFile(page, locale);
  const rendered = await renderMarkdown(readRepoFile(file), { fromFile: file, locale });
  const englishOnly = locale !== InterfaceLanguageEnum.en && !page.ruFile;

  return (
    <div className={styles.content}>
      <article className={styles.article}>
        {englishOnly && <div className={styles.note}>{t('english_only')}</div>}
        <Markdown html={rendered.html} />
        <div className={styles.edit}>
          <a href={`${REPO_BLOB_URL}/${file}`}>{t('edit_on_github')}</a>
        </div>
      </article>
      <aside className={styles.aside}>
        <Toc headings={rendered.headings} title={t('on_this_page')} />
      </aside>
    </div>
  );
}
