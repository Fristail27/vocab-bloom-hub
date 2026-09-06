import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { PublicWordV1MeaningT, PublicWordV1T } from 'server/types';

import { Pronounce } from '@/components/Pronounce';
import { ReportMistake } from '@/components/ReportMistake';
import { WordSearch } from '@/components/WordSearch';
import { fetchHeadword } from '@/core/dictionary';
import { localeAlternates, pageMeta, siteUrl } from '@/core/site';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from '../word.module.scss';

type WordPageP = LocaleParamsP<{ word: string }>;

// rendered on request from the instance's API, cached (core/dictionary.ts)
export const dynamic = 'force-dynamic';

const headwordOf = async (params: WordPageP['params']) => {
  const { locale, word } = await params;

  return { locale, word: decodeURIComponent(word) };
};

export const generateMetadata = async ({ params }: WordPageP): Promise<Metadata> => {
  const { locale, word } = await headwordOf(params);
  const t = await getTranslations({ locale, namespace: 'word' });
  const headword = await fetchHeadword(word);
  // the API being down must not get thin placeholder pages indexed (issue #399)
  if (headword.kind === 'unavailable') return { title: word, robots: { index: false } };
  if (headword.kind !== 'found') return { title: word };

  const first = headword.result.data[0];
  const definition = first?.meanings[0]?.definition;
  const translations = first?.short_translations.map((item) => item.description).join(', ');

  return {
    ...pageMeta(
      t('page_title', { word: headword.result.meta.word }),
      [definition, translations].filter(Boolean).join(' — ') || t('page_description', { word }),
    ),
    alternates: localeAlternates(locale, `/word/${encodeURIComponent(word)}`),
  };
};

// the data writes transcriptions as `/rʌn/` or bare; shown once between slashes
const ipa = (value: string): string => `/${value.replace(/^[/[]|[/\]]$/g, '')}/`;

const WordLink = ({ word }: { word: string }) => <Link href={`/word/${encodeURIComponent(word)}`}>{word}</Link>;

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

const Meaning = ({ meaning, t }: { meaning: PublicWordV1MeaningT; t: TranslateT }) => (
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
        {meaning.translations.map((translation) => (
          <span key={translation.id} lang={translation.language} title={translation.definition}>
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

const Entry = ({ entry, t }: { entry: PublicWordV1T; t: TranslateT }) => {
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
          {entry.short_translations.map((item) => (
            <span key={item.id} lang={item.language}>
              {item.description}
            </span>
          ))}
        </p>
      )}
      {entry.meanings.length > 0 && (
        <ol className={styles.meanings}>
          {entry.meanings.map((meaning) => (
            <Meaning key={meaning.id} meaning={meaning} t={t} />
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
  if (headword.kind === 'unavailable') {
    return (
      <div className={`container ${styles.page}`}>
        <h1>{word}</h1>
        <p className={styles.intro}>{t('unavailable')}</p>
      </div>
    );
  }

  const { data, meta } = headword.result;
  const transcription = data.find((entry) => entry.transcription)?.transcription;

  // structured data for search engines (issue #350): one DefinedTerm per page
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: meta.word,
    description: data[0]?.meanings[0]?.definition || data[0]?.description || undefined,
    url: `${siteUrl()}/${locale}/word/${encodeURIComponent(meta.word)}`,
  };

  return (
    <div className={`container ${styles.page}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={styles.headword}>
        <h1>{meta.word}</h1>
        <Pronounce word={meta.word} />
        {transcription && <span className={styles.transcription}>{ipa(transcription)}</span>}
      </div>
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
        <Entry key={entry.id} entry={entry} t={t} />
      ))}
      <div className={styles.footer}>
        <p>
          {t('from_api')} <code>GET /api/v1/words/{encodeURIComponent(meta.word)}</code> —{' '}
          <Link href={`/playground?endpoint=get-words-word`}>{t('try_in_playground')}</Link>
          {' · '}
          <Link href="/docs/data-license">{t('license_note')}</Link>
        </p>
        <WordSearch />
      </div>
    </div>
  );
}
