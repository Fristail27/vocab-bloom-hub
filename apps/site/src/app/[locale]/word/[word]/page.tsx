import React, { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { PublicChangeV1T } from 'server/types';

import { JsonLd } from '@/components/JsonLd';
import { WordSearch } from '@/components/WordSearch';
import {
  DictionaryUnavailableError,
  fetchDatasetHistory,
  fetchDatasetTerms,
  fetchHeadword,
  fetchHeadwordDatasets,
  fetchHeadwordHistory,
} from '@/core/dictionary';
import { pageMeta, trimDescription } from '@/core/site';
import { breadcrumbJsonLd, definedTermJsonLd } from '@/core/structuredData';
import { defaultPanel, wordPanels } from '@/core/wordDatasets';
import { leadDefinition, localeTranslations } from '@/core/wordPage';
import type { WordPanelT } from '@/core/wordPanel';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from '../word.module.scss';
import { DatasetPanels } from './_components/DatasetPanels';
import { wordPath } from './_components/Entry';
import { Panel } from './_components/Panel';

type WordPageP = LocaleParamsP<{ word: string }> & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const queryOf = async (searchParams: WordPageP['searchParams']): Promise<string> => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }
  return query.toString();
};

// Check dataset visibility on every request, including previously rendered URLs.
export const dynamic = 'force-dynamic';
export const generateStaticParams = () => [];

const headwordOf = async (params: WordPageP['params']) => {
  const { locale, word } = await params;

  return { locale, word: decodeURIComponent(word) };
};

type ResolvedT =
  | { kind: 'unavailable' }
  | { kind: 'not_found' }
  | { kind: 'dataset_unavailable'; fallback: string }
  | {
      kind: 'found';
      /** Only the selected panel is rendered; the rest supply tab names. */
      panels: WordPanelT[];
      lead: WordPanelT;
    };

// Share the public reads and resolution between metadata and the page.
// Query strings are primitive cache keys; redirects retain all parameters.
const resolve = cache(async (locale: string, word: string, query: string): Promise<ResolvedT> => {
  const selectors = new URLSearchParams(query).getAll('dataset');
  const [headword, terms, groups] = await Promise.all([
    fetchHeadword(word),
    fetchDatasetTerms(),
    fetchHeadwordDatasets(word),
  ]);
  if (headword.kind === 'unavailable') return { kind: 'unavailable' };

  const panels = wordPanels({ headword: headword.kind === 'found' ? headword.result : null, terms, groups });
  const first = defaultPanel(panels);
  const selector = selectors.length === 1 ? selectors[0] : null;
  const lead =
    selectors.length === 0
      ? first
      : panels.find(
          (panel) => panel.dataset === selector && groups.some((group) => group.dataset === panel.dataset),
        );
  if (selectors.length > 0 && !lead) {
    const fallbackQuery = new URLSearchParams(query);
    fallbackQuery.delete('dataset');
    const suffix = fallbackQuery.size ? `?${fallbackQuery}` : '';
    return { kind: 'dataset_unavailable', fallback: `${wordPath(first?.word ?? word)}${suffix}` };
  }
  if (!lead) return { kind: 'not_found' };
  if (!panels.some((panel) => panel.word === word)) {
    permanentRedirect(`/${locale}${wordPath(lead.word)}${query ? `?${query}` : ''}`);
  }

  return { kind: 'found', panels, lead };
});

// how many of the locale's translations fit a title
const TITLE_TRANSLATIONS = 4;

export const generateMetadata = async ({ params, searchParams }: WordPageP): Promise<Metadata> => {
  const { locale, word } = await headwordOf(params);
  const t = await getTranslations({ locale, namespace: 'word' });
  const query = await queryOf(searchParams);
  const resolved = await resolve(locale, word, query);
  // the API being down must not get thin placeholder pages indexed (issue #399)
  if (resolved.kind === 'unavailable') return { title: word, robots: { index: false } };
  if (resolved.kind === 'not_found') return { title: word };
  if (resolved.kind === 'dataset_unavailable') {
    return {
      title: t('dataset_unavailable_title'),
      description: t('dataset_unavailable'),
      robots: { index: false, follow: true },
    };
  }

  const { panels, lead } = resolved;
  const definition = leadDefinition(lead.entries);
  // the locale's own translations lead the title and the description (issue
  // #480): "bloom — перевод: цветок, цветение"; the English pattern otherwise
  const translations = localeTranslations(lead.entries, locale);
  const title = translations.length
    ? t('page_title_translated', {
        word: lead.word,
        translations: translations.slice(0, TITLE_TRANSLATIONS).join(', '),
      })
    : t('page_title', { word: lead.word });
  const description = translations.length
    ? [t('translations_of', { word: lead.word, translations: translations.join(', ') }), definition]
        .filter(Boolean)
        .join(' ')
    : definition || t('page_description', { word: lead.word });
  // The search engines are given the words of the dictionary the site
  // serves: the sitemap and the index of words are its headwords. A word the
  // served dataset does not hold is a page for a reader who followed a link
  if (!panels.some((panel) => panel.active) && !new URLSearchParams(query).has('dataset')) {
    return { title, description: trimDescription(description), robots: { index: false, follow: true } };
  }

  const selected = new URLSearchParams(query).get('dataset');
  const canonical = wordPath(defaultPanel(panels)!.word);
  const metadata = pageMeta({
    locale,
    path: selected ? `${wordPath(word)}?${new URLSearchParams({ dataset: selected })}` : canonical,
    title,
    // a snippet's length: search engines cut a description at about 160 characters
    description: trimDescription(description),
    type: 'article',
  });
  // Tabs are shareable views, not additional indexable copies. Their social
  // metadata describes the selected entry; the canonical stays the normal page.
  return selected
    ? {
        ...metadata,
        alternates: { canonical: `/${locale}${canonical}` },
        robots: { index: false, follow: true },
      }
    : metadata;
};

// what was changed on the instance (issue #531): asked for only where an entry says it was
const historyOf = async (panel: WordPanelT): Promise<PublicChangeV1T[]> => {
  if (!panel.entries.some((entry) => entry.modified)) return [];

  return panel.active ? fetchHeadwordHistory(panel.word) : fetchDatasetHistory(panel.word, panel.dataset);
};

export default async function WordPage({ params, searchParams }: WordPageP) {
  const { locale, word } = await headwordOf(params);
  setRequestLocale(locale);
  const t = await getTranslations('word');
  const nav = await getTranslations('nav');
  const termsNames = await getTranslations('terms');
  const query = await queryOf(searchParams);
  const resolved = await resolve(locale, word, query);

  // An API failure must not become a successful placeholder page.
  if (resolved.kind === 'unavailable') throw new DictionaryUnavailableError();
  if (resolved.kind === 'not_found') notFound();
  if (resolved.kind === 'dataset_unavailable') {
    return (
      <div className={`container ${styles.page}`}>
        <h1>{t('dataset_unavailable_title')}</h1>
        <p role="status">{t('dataset_unavailable')}</p>
        <Link href={resolved.fallback}>{t('dataset_default_page')}</Link>
        <div className={styles.footer}>
          <WordSearch />
        </div>
      </div>
    );
  }

  const { panels, lead } = resolved;
  const history = await historyOf(lead);

  return (
    <div className={`container ${styles.page}`}>
      {/* structured data for search engines (issues #350, #480): the trail and the term in its dictionary */}
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, [
            { name: t('index_title'), path: '/word' },
            { name: lead.word, path: wordPath(lead.word) },
          ]),
          definedTermJsonLd({
            locale,
            word: lead.word,
            description: leadDefinition(lead.entries),
            terms: lead.terms,
          }),
        ]}
      />
      {/* A navigation renders one panel and keeps the tab buttons mounted. */}
      <DatasetPanels
        selected={lead.dataset}
        tabs={panels.map(({ dataset, title }) => ({ dataset, title }))}
        headline={{
          word: lead.word,
          transcription: lead.entries.find((entry) => entry.transcription)?.transcription ?? null,
        }}
      >
        <Panel
          panel={lead}
          selectedDataset={new URLSearchParams(query).get('dataset') ?? undefined}
          history={history}
          locale={locale}
          t={t}
          termsNames={termsNames}
          languageLabel={nav('language')}
        />
      </DatasetPanels>
      <div className={styles.footer}>
        <WordSearch />
      </div>
    </div>
  );
}
