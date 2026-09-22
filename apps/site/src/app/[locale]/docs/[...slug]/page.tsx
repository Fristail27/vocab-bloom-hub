import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { JsonLd } from '@/components/JsonLd';
import { Markdown } from '@/components/Markdown';
import { Toc } from '@/components/Toc';
import { firstParagraph } from '@/content/description';
import { renderMarkdown } from '@/content/markdown';
import { extractSection } from '@/content/sections';
import {
  DOC_PAGES,
  docFile,
  docLocales,
  DocPageT,
  docTitle,
  findDocBySlug,
  translatedDocFile,
} from '@/content/registry';
import { readRepoFile, REPO_BLOB_URL, repoFileDate } from '@/content/repo';
import { pageMeta } from '@/core/site';
import { breadcrumbJsonLd, techArticleJsonLd } from '@/core/structuredData';
import { routing } from '@/i18n/routing';
import { localeDirection } from '@/i18n/direction';
import { InterfaceLanguageEnum, LocaleParamsP } from '@/types/common';

import styles from '../docs.module.scss';

type DocPageP = LocaleParamsP<{ slug: string[] }>;

// every documented file, in every locale, rendered at build time
export const generateStaticParams = () =>
  routing.locales.flatMap((locale) => DOC_PAGES.map((page) => ({ locale, slug: page.slug.split('/') })));

export const dynamicParams = false;

// the Markdown a page renders in a locale: its translation when there is one, else the English file
const sourceOf = (page: DocPageT, locale: InterfaceLanguageEnum): { file: string; markdown: string | null } => {
  const file = docFile(page, locale);
  const source = readRepoFile(file);
  return { file, markdown: page.extract ? extractSection(source, page.extract) : source };
};

export const generateMetadata = async ({ params }: DocPageP): Promise<Metadata> => {
  const { locale, slug } = await params;
  const page = findDocBySlug(slug.join('/'));
  if (!page) return {};

  // the description is the page's first paragraph (issue #480): the layout's
  // default described every docs page as the whole platform
  const { markdown } = sourceOf(page, locale);
  return pageMeta({
    locale,
    path: `/docs/${page.slug}`,
    title: docTitle(page, locale),
    description: (markdown && firstParagraph(markdown)) ?? undefined,
    type: 'article',
    // an untranslated page under /de is the English page: one canonical, no duplicate
    locales: docLocales(page),
  });
};

export default async function DocPage({ params }: DocPageP) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = findDocBySlug(slug.join('/'));
  if (!page) notFound();

  const t = await getTranslations('docs');
  const { file, markdown } = sourceOf(page, locale);
  // a section the registry names must exist in every translation: fail the build, not the reader
  if (markdown === null)
    throw new Error(`${file} has no section matching ${String(page.extract)} (docs page "${page.slug}")`);
  const rendered = await renderMarkdown(markdown, {
    fromFile: file,
    locale,
    callouts: {
      note: t('callouts.note'),
      tip: t('callouts.tip'),
      important: t('callouts.important'),
      warning: t('callouts.warning'),
      caution: t('callouts.caution'),
    },
  });
  const englishOnly = locale !== InterfaceLanguageEnum.en && !translatedDocFile(page, locale);
  const path = `/docs/${page.slug}`;

  return (
    <div className={styles.content}>
      {/* the trail and the article, in the language of the file it renders (issue #480) */}
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, [
            { name: t('title'), path: '/docs' },
            { name: docTitle(page, locale), path },
          ]),
          techArticleJsonLd({
            locale,
            path,
            headline: rendered.title ?? docTitle(page, locale),
            description: (markdown && firstParagraph(markdown)) ?? undefined,
            inLanguage: englishOnly ? 'en' : locale,
            dateModified: repoFileDate(file),
          }),
        ]}
      />
      {/* the Markdown keeps the direction of its own language: English pages stay left-to-right under /ar */}
      <article
        className={styles.article}
        lang={englishOnly ? 'en' : locale}
        dir={englishOnly ? 'ltr' : localeDirection(locale)}
      >
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
