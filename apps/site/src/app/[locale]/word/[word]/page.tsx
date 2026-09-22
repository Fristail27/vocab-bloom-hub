import React from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { PublicWordV1MeaningT, PublicWordV1T } from 'server/types';

import { JsonLd } from '@/components/JsonLd';
import { Pronounce } from '@/components/Pronounce';
import { ReportMistake } from '@/components/ReportMistake';
import { WordSearch } from '@/components/WordSearch';
import { DictionaryUnavailableError, fetchHeadword } from '@/core/dictionary';
import { pageMeta, trimDescription } from '@/core/site';
import { breadcrumbJsonLd, definedTermJsonLd } from '@/core/structuredData';
import { leadDefinition, localeFirst, localeTranslations } from '@/core/wordPage';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from '../word.module.scss';

type WordPageP = LocaleParamsP<{ word: string }>;

// Rendered on the first request from the instance's API and regenerated
// after an hour (ISR, next.config.ts): no headword is known at build time,
// so nothing is prerendered. The API being down throws — a render that
// failed is not kept, the stale copy is served when there is one
export const revalidate = 3600;
export const generateStaticParams = () => [];

const headwordOf = async (params: WordPageP['params']) => {
  const { locale, word } = await params;

  return { locale, word: decodeURIComponent(word) };
};

const wordPath = (word: string): string => `/word/${encodeURIComponent(word)}`;

// The one URL of a headword is its normalized spelling, `meta.word` of the
// API answer (issue #480): /en/word/Bloom answered 200 with a canonical of
// its own, one indexable page per spelling variant. A 308 folds them
const canonicalOrRedirect = (locale: string, word: string, canonical: string): void => {
  if (word !== canonical) permanentRedirect(`/${locale}${wordPath(canonical)}`);
};

export const generateMetadata = async ({ params }: WordPageP): Promise<Metadata> => {
  const { locale, word } = await headwordOf(params);
  const t = await getTranslations({ locale, namespace: 'word' });
  const headword = await fetchHeadword(word);
  // the API being down must not get thin placeholder pages indexed (issue #399)
  if (headword.kind === 'unavailable') return { title: word, robots: { index: false } };
  if (headword.kind !== 'found') return { title: word };

  const { data, meta } = headword.result;
  canonicalOrRedirect(locale, word, meta.word);
  const definition = leadDefinition(data);
  // the locale's own translations lead the title and the description (issue
  // #480): "bloom — перевод: цветок, цветение"; the English pattern otherwise
  const translations = localeTranslations(data, locale);
  const title = translations.length
    ? t('page_title_translated', {
        word: meta.word,
        translations: translations.slice(0, TITLE_TRANSLATIONS).join(', '),
      })
    : t('page_title', { word: meta.word });
  const description = translations.length
    ? [t('translations_of', { word: meta.word, translations: translations.join(', ') }), definition]
        .filter(Boolean)
        .join(' ')
    : definition || t('page_description', { word: meta.word });

  return pageMeta({
    locale,
    path: wordPath(meta.word),
    title,
    // a snippet's length: search engines cut a description at about 160 characters
    description: trimDescription(description),
    type: 'article',
  });
};

// how many of the locale's translations fit a title
const TITLE_TRANSLATIONS = 4;

// the data writes transcriptions as `/rʌn/` or bare; shown once between slashes
const ipa = (value: string): string => `/${value.replace(/^[/[]|[/\]]$/g, '')}/`;

const WordLink = ({ word }: { word: string }) => <Link href={wordPath(word)}>{word}</Link>;

type TranslateT = Awaited<ReturnType<typeof getTranslations>>;

const humanize = (value: string): string => value.replace(/_/g, ' ');

// the grammar flags of an entry as short localized phrases (issue #399)
const grammarOf = (entry: PublicWordV1T, t: TranslateT): string[] =>
  [
    entry.noun___uncountable && t('uncountable'),
    entry.noun___always_plural && t('always_plural'),
    entry.noun___irregular_plural && t('irregular_plural'),
    entry.noun___is_proper && t('proper_noun'),
    entry.verb___is_irregular && t('irregular_verb'),
    entry.verb___transitivity && t(`transitivity_${entry.verb___transitivity}`),
    entry.verb___phrasal_object_pattern && t(`phrasal_${entry.verb___phrasal_object_pattern}`),
  ].filter((item): item is string => Boolean(item));

// The translation languages present in a list (issue #410): a label per
// item is shown only when the list mixes languages, so a single-language
// dictionary reads as before
const mixesLanguages = (items: ReadonlyArray<{ language: string }>): boolean =>
  new Set(items.map((item) => item.language)).size > 1;

const LanguageTag = ({ language }: { language: string }) => <small className={styles.tag}>{language}</small>;

const Meaning = ({ meaning, locale, t }: { meaning: PublicWordV1MeaningT; locale: string; t: TranslateT }) => (
  <li>
    {meaning.title && <span className={styles.meaningTitle}>{meaning.title}</span>}
    {meaning.meaning_level && <span className={styles.tag}> {meaning.meaning_level}</span>}
    {meaning.language_register && <span className={styles.tag}> {meaning.language_register}</span>}
    {String(meaning.area_variant) !== 'common' && (
      <span className={styles.tag}> {humanize(String(meaning.area_variant))}</span>
    )}
    {meaning.categories?.map((category) => (
      <span key={category} className={styles.tag}>
        {' '}
        {humanize(category)}
      </span>
    ))}
    {meaning.is_obsolete && <span className={styles.tag}> {t('obsolete')}</span>}
    <p className={styles.definition}>{meaning.definition}</p>
    {meaning.examples.length > 0 && (
      <ul className={styles.examplesList}>
        {meaning.examples.map((example) => (
          <li key={example}>{example}</li>
        ))}
      </ul>
    )}
    {meaning.translations.length > 0 && (
      <p className={styles.translations}>
        {localeFirst(meaning.translations, locale).map((translation) => (
          <span key={translation.id} lang={translation.language} dir="auto" title={translation.definition}>
            {mixesLanguages(meaning.translations) && <LanguageTag language={translation.language} />}
            {translation.title}
          </span>
        ))}
      </p>
    )}
    {meaning.synonyms.length > 0 && (
      <p className={styles.relations}>
        {t('synonyms')}:{' '}
        {meaning.synonyms.map((word) => (
          <WordLink key={word} word={word} />
        ))}
      </p>
    )}
    {meaning.antonyms.length > 0 && (
      <p className={styles.relations}>
        {t('antonyms')}:{' '}
        {meaning.antonyms.map((word) => (
          <WordLink key={word} word={word} />
        ))}
      </p>
    )}
  </li>
);

const Entry = ({ entry, locale, t }: { entry: PublicWordV1T; locale: string; t: TranslateT }) => {
  const grammar = grammarOf(entry, t);

  return (
    <section className={styles.entry}>
      <div className={styles.entryHead}>
        <h2>{entry.part_of_speech.replace(/_/g, ' ')}</h2>
        {entry.word_level && <span className={styles.tag}>{entry.word_level}</span>}
        {entry.language_register && <span className={styles.tag}>{entry.language_register}</span>}
        {entry.area_variant && <span className={styles.tag}>{entry.area_variant}</span>}
        {entry.form_of_word !== 'base_form' && (
          <span className={styles.tag}>{String(entry.form_of_word).replace(/_/g, ' ')}</span>
        )}
        {entry.categories?.map((category) => (
          <span key={category} className={styles.tag}>
            {humanize(category)}
          </span>
        ))}
        {entry.is_abbreviation && <span className={styles.tag}>{t('abbreviation')}</span>}
        {entry.is_obsolete && <span className={styles.tag}>{t('obsolete')}</span>}
        {entry.transcription && <span className={styles.transcription}>{ipa(entry.transcription)}</span>}
      </div>
      {grammar.length > 0 && <p className={styles.grammar}>{grammar.join(' · ')}</p>}
      {entry.pattern && entry.pattern.length > 0 && (
        <p className={styles.grammar}>
          {t('patterns')}: <code>{entry.pattern.join(' · ')}</code>
        </p>
      )}
      {entry.description && <p className={styles.description}>{entry.description}</p>}
      {entry.short_translations.length > 0 && (
        <p className={styles.short}>
          {localeFirst(entry.short_translations, locale).map((item) => (
            <span key={item.id} lang={item.language} dir="auto">
              {mixesLanguages(entry.short_translations) && <LanguageTag language={item.language} />}
              {item.description}
            </span>
          ))}
        </p>
      )}
      {entry.meanings.length > 0 && (
        <ol className={styles.meanings}>
          {entry.meanings.map((meaning) => (
            <Meaning key={meaning.id} meaning={meaning} locale={locale} t={t} />
          ))}
        </ol>
      )}
      {entry.forms.length > 0 && (
        <ul className={styles.forms}>
          {entry.forms.map((form) => (
            <li key={form.id}>
              {form.word} <Pronounce word={form.word} small />{' '}
              <small>{String(form.form_of_word).replace(/_/g, ' ')}</small>
            </li>
          ))}
        </ul>
      )}
      {entry.base_phrasal && (
        <p className={styles.relations}>
          {t('base_phrasal')}: <WordLink word={entry.base_phrasal} />
        </p>
      )}
      {entry.phrasal_variants && entry.phrasal_variants.length > 0 && (
        <p className={styles.relations}>
          {t('phrasal_variants')}:{' '}
          {entry.phrasal_variants.map((word) => (
            <WordLink key={word} word={word} />
          ))}
        </p>
      )}
    </section>
  );
};

export default async function WordPage({ params }: WordPageP) {
  const { locale, word } = await headwordOf(params);
  setRequestLocale(locale);
  const t = await getTranslations('word');
  const headword = await fetchHeadword(word);

  if (headword.kind === 'not_found') notFound();
  // the page is cacheable (next.config.ts); one the API failed to render must not be
  if (headword.kind === 'unavailable') throw new DictionaryUnavailableError();

  const { data, meta } = headword.result;
  canonicalOrRedirect(locale, word, meta.word);
  const transcription = data.find((entry) => entry.transcription)?.transcription;
  // the locale's translations on the first screen, before the entries
  const translations = localeTranslations(data, locale);

  return (
    <div className={`container ${styles.page}`}>
      {/* structured data for search engines (issues #350, #480): the trail and the term in its dictionary */}
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, [
            { name: t('index_title'), path: '/word' },
            { name: meta.word, path: wordPath(meta.word) },
          ]),
          definedTermJsonLd({ locale, word: meta.word, description: leadDefinition(data) }),
        ]}
      />
      <div className={styles.headword}>
        <h1>{meta.word}</h1>
        <Pronounce word={meta.word} />
        {transcription && <span className={styles.transcription}>{ipa(transcription)}</span>}
      </div>
      {translations.length > 0 && (
        <p className={styles.lead}>
          <span className={styles.leadLabel}>{t('translation_label')}:</span>{' '}
          <span lang={locale} dir="auto">
            {translations.join(', ')}
          </span>
        </p>
      )}
      <div className={styles.metaRow}>
        <p className={styles.meta}>{t('entries', { count: meta.count })}</p>
        <ReportMistake
          headword={meta.word}
          entries={data.map((entry) => ({
            id: entry.id,
            part_of_speech: entry.part_of_speech,
            description: entry.description ?? '',
            transcription: entry.transcription ?? '',
            meanings: entry.meanings.map((meaning) => ({
              id: meaning.id,
              title: meaning.title ?? '',
              definition: meaning.definition ?? '',
              translations: meaning.translations.map((translation) => ({
                id: translation.id,
                title: translation.title ?? '',
                definition: translation.definition ?? '',
              })),
            })),
            short_translations: entry.short_translations.map((item) => ({
              id: item.id,
              description: item.description ?? '',
            })),
          }))}
        />
      </div>
      {data.map((entry) => (
        <Entry key={entry.id} entry={entry} locale={locale} t={t} />
      ))}
      <div className={styles.footer}>
        <p>
          {t('from_api')} <code>GET /api/v1/words/{encodeURIComponent(meta.word)}</code> —{' '}
          <Link href={`/playground?endpoint=get-words-word`}>{t('try_in_playground')}</Link>
          {' · '}
          <Link href="/docs/data-license">{t('license_note')}</Link>
          {' · '}
          <Link href="/docs/data">{t('ai_note')}</Link>
        </p>
        <WordSearch />
      </div>
    </div>
  );
}
