import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { EnMeaningT, EnWordT } from 'server/types';

import { WordSearch } from '@/components/WordSearch';
import { fetchHeadword } from '@/core/dictionary';
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
  if (headword.kind !== 'found') return { title: word };

  const first = headword.result.data[0];
  const definition = first?.meanings[0]?.definition;
  const translations = first?.short_translations.map((item) => item.description).join(', ');

  return {
    title: t('page_title', { word: headword.result.meta.word }),
    description: [definition, translations].filter(Boolean).join(' — ') || t('page_description', { word }),
  };
};

// the data writes transcriptions as `/rʌn/` or bare; shown once between slashes
const ipa = (value: string): string => `/${value.replace(/^[/[]|[/\]]$/g, '')}/`;

const WordLink = ({ word }: { word: string }) => <Link href={`/word/${encodeURIComponent(word)}`}>{word}</Link>;

const Meaning = ({
  meaning,
  labels,
}: {
  meaning: EnMeaningT;
  labels: { synonyms: string; antonyms: string };
}) => (
  <li>
    {meaning.title && <span className={styles.meaningTitle}>{meaning.title}</span>}
    {meaning.meaning_level && <span className={styles.tag}> {meaning.meaning_level}</span>}
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
        {labels.synonyms}:{' '}
        {meaning.synonyms.map((word) => (
          <WordLink key={word} word={word} />
        ))}
      </p>
    )}
    {meaning.antonyms.length > 0 && (
      <p className={styles.relations}>
        {labels.antonyms}:{' '}
        {meaning.antonyms.map((word) => (
          <WordLink key={word} word={word} />
        ))}
      </p>
    )}
  </li>
);

const Entry = ({ entry, labels }: { entry: EnWordT; labels: Record<string, string> }) => (
  <section className={styles.entry}>
    <div className={styles.entryHead}>
      <h2>{entry.part_of_speech.replace(/_/g, ' ')}</h2>
      {entry.word_level && <span className={styles.tag}>{entry.word_level}</span>}
      {entry.language_register && <span className={styles.tag}>{entry.language_register}</span>}
      {entry.area_variant && <span className={styles.tag}>{entry.area_variant}</span>}
      {entry.form_of_word !== 'base_form' && (
        <span className={styles.tag}>{String(entry.form_of_word).replace(/_/g, ' ')}</span>
      )}
      {entry.transcription && <span className={styles.transcription}>{ipa(entry.transcription)}</span>}
    </div>
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
          <Meaning
            key={meaning.id}
            meaning={meaning}
            labels={{ synonyms: labels.synonyms, antonyms: labels.antonyms }}
          />
        ))}
      </ol>
    )}
    {entry.forms.length > 0 && (
      <ul className={styles.forms}>
        {entry.forms.map((form) => (
          <li key={form.id}>
            {form.word} <small>{String(form.form_of_word).replace(/_/g, ' ')}</small>
          </li>
        ))}
      </ul>
    )}
    {entry.base_form && (
      <p className={styles.relations}>
        {labels.base_form}: <WordLink word={entry.base_form.word} />
      </p>
    )}
    {entry.phrasal_variants && entry.phrasal_variants.length > 0 && (
      <p className={styles.relations}>
        {labels.phrasal}:{' '}
        {entry.phrasal_variants.map((word) => (
          <WordLink key={word} word={word} />
        ))}
      </p>
    )}
  </section>
);

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
  const labels = {
    synonyms: t('synonyms'),
    antonyms: t('antonyms'),
    base_form: t('base_form'),
    phrasal: t('phrasal_variants'),
  };
  const transcription = data.find((entry) => entry.transcription)?.transcription;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.headword}>
        <h1>{meta.word}</h1>
        {transcription && <span className={styles.transcription}>{ipa(transcription)}</span>}
      </div>
      <p className={styles.meta}>{t('entries', { count: meta.count })}</p>
      {data.map((entry) => (
        <Entry key={entry.id} entry={entry} labels={labels} />
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
