import { Origins } from '@/components/Origins';
import React from 'react';
import type { PublicChangeV1T, PublicWordV1MeaningT, PublicWordV1T } from 'server/types';

import { Flag } from '@/components/Flag';
import { Pronounce } from '@/components/Pronounce';
import { entryDescription, foldedMeanings, meaningTitle } from '@/core/wordPage';
import { Link } from '@/i18n/navigation';

import styles from '../../word.module.scss';
import { ForLanguage } from './TranslationLanguage';
import type { TranslateT } from './translate';
import { WordHistory } from './WordHistory';

// the data writes transcriptions as `/rʌn/` or bare; shown once between slashes
export const ipa = (value: string): string => `/${value.replace(/^[/[]|[/\]]$/g, '')}/`;

export const wordPath = (word: string): string => `/word/${encodeURIComponent(word)}`;

export const WordLink = ({ word }: { word: string }) => <Link href={wordPath(word)}>{word}</Link>;

const humanize = (value: string): string => value.replace(/_/g, ' ');

// The words of the dictionary are English on a page of any language. In a
// page written right to left they stay on its side, read left to right: the
// full stop of a definition is at its end, not before its first word
const English = ({ children }: { children: React.ReactNode }) => (
  <bdi lang="en" dir="ltr">
    {children}
  </bdi>
);

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

// the language of a translation as its flag (issue #520); the code for a screen reader
const LanguageTag = ({ language }: { language: string }) => (
  <Flag language={language} className={styles.flagTag} />
);

type ShortTranslationT = PublicWordV1T['short_translations'][number];

// The short translations of an entry (issue #520): a line per item, the
// chosen language's shown, the others in the HTML but hidden
const ShortTranslations = ({ items }: { items: ShortTranslationT[] }) => (
  <ul className={styles.short}>
    {items.map((item) => (
      <ForLanguage key={item.id} language={item.language} as="li">
        <LanguageTag language={item.language} />
        <span>{item.description}</span>
      </ForLanguage>
    ))}
  </ul>
);

// the words a meaning or an entry leads to, under the name of what they are to it
const Relations = ({ label, words }: { label: string; words: string[] }) => (
  <p className={styles.relations}>
    <span className={styles.label}>{label}</span>
    {words.map((word) => (
      <WordLink key={word} word={word} />
    ))}
  </p>
);

type MeaningP = { meaning: PublicWordV1MeaningT; t: TranslateT };

const Meaning = ({ meaning, t }: MeaningP) => {
  const title = meaningTitle(meaning);
  const tags = [
    meaning.meaning_level,
    meaning.language_register,
    String(meaning.area_variant) !== 'common' && humanize(String(meaning.area_variant)),
    ...(meaning.categories ?? []).map(humanize),
    meaning.is_obsolete && t('obsolete'),
  ].filter((tag): tag is string => Boolean(tag));

  return (
    <li className={styles.meaning}>
      {(title || tags.length > 0) && (
        <p className={styles.meaningHead}>
          {title && (
            <span className={styles.meaningTitle}>
              <English>{title}</English>
            </span>
          )}
          {tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </p>
      )}
      {/* without a title the definition is what names the meaning */}
      <p className={title ? styles.definition : styles.definitionLead}>
        <English>{meaning.definition}</English>
      </p>
      {meaning.translations.length > 0 && (
        <p className={styles.translations}>
          {meaning.translations.map((translation) => (
            <ForLanguage key={translation.id} language={translation.language}>
              <LanguageTag language={translation.language} />
              <span title={translation.definition}>{translation.title}</span>
            </ForLanguage>
          ))}
        </p>
      )}
      {meaning.examples.length > 0 && (
        <ul className={styles.examplesList}>
          {meaning.examples.map((example) => (
            <li key={example}>
              <English>{example}</English>
            </li>
          ))}
        </ul>
      )}
      {meaning.synonyms.length > 0 && <Relations label={t('synonyms')} words={meaning.synonyms} />}
      {meaning.antonyms.length > 0 && <Relations label={t('antonyms')} words={meaning.antonyms} />}
    </li>
  );
};

type EntryP = {
  entry: PublicWordV1T;
  // the spelling the page is about: an entry of another spelling says its own
  headword: string;
  // what was changed in this entry on the instance (issue #531)
  changes: PublicChangeV1T[];
  locale: string;
  t: TranslateT;
};

/**
 * An entry as a card (issue #538): the part of speech and the pronunciation
 * at its head, then what a reader came for — the translations and the
 * meanings, each with its definition first — and what is looked up less
 * often below, the forms and the history folded or small.
 */
export const Entry = ({ entry, headword, changes, locale, t }: EntryP) => {
  const grammar = grammarOf(entry, t);
  const description = entryDescription(entry);
  const { shown, folded } = foldedMeanings(entry.meanings);
  const tags = [
    entry.language_register,
    entry.area_variant && String(entry.area_variant) !== 'common' && humanize(String(entry.area_variant)),
    entry.form_of_word !== 'base_form' && humanize(String(entry.form_of_word)),
    ...(entry.categories ?? []).map(humanize),
    entry.is_abbreviation && t('abbreviation'),
    entry.is_obsolete && t('obsolete'),
  ].filter((tag): tag is string => Boolean(tag));

  return (
    <section className={styles.entry} data-testid={`entry-${entry.id}`}>
      <header className={styles.entryHead}>
        <h2>{humanize(entry.part_of_speech)}</h2>
        {/* "ran" leads to the verb "run", "TEST" to "Test" and "test": the entry names the word it is */}
        {entry.word !== headword && (
          <span className={styles.entrySpelling} data-testid="entry-spelling">
            <WordLink word={entry.word} />
          </span>
        )}
        {entry.transcription && <span className={styles.transcription}>{ipa(entry.transcription)}</span>}
        {(entry.word_level || tags.length > 0) && (
          <span className={styles.tags}>
            {entry.word_level && <span className={styles.level}>{entry.word_level}</span>}
            {tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </span>
        )}
      </header>
      <div className={styles.entryBody}>
        {/* the licenses of the datasets ask that a reader is told (issue #531) */}
        {entry.modified && (
          <p className={styles.modified} data-testid="entry-modified">
            {t('modified_note')}
          </p>
        )}
        {entry.short_translations.length > 0 && <ShortTranslations items={entry.short_translations} />}
        {description && (
          <p className={styles.description}>
            <English>{description}</English>
          </p>
        )}
        {grammar.length > 0 && <p className={styles.grammar}>{grammar.join(' · ')}</p>}
        {entry.pattern && entry.pattern.length > 0 && (
          <p className={styles.grammar}>
            <span className={styles.label}>{t('patterns')}</span>
            <code>{entry.pattern.join(' · ')}</code>
          </p>
        )}
        {shown.length > 0 && (
          <ol className={styles.meanings}>
            {shown.map((meaning) => (
              <Meaning key={meaning.id} meaning={meaning} t={t} />
            ))}
          </ol>
        )}
        {folded.length > 0 && (
          <details className={styles.more}>
            <summary>{t('more_meanings', { count: folded.length })}</summary>
            {/* the numbers go on from the meanings in the open */}
            <ol className={styles.meanings} style={{ counterReset: `meaning ${shown.length}` }}>
              {folded.map((meaning) => (
                <Meaning key={meaning.id} meaning={meaning} t={t} />
              ))}
            </ol>
          </details>
        )}
        {entry.forms.length > 0 && (
          <div className={styles.formsBlock}>
            <span className={styles.label}>{t('forms')}</span>
            <ul className={styles.forms}>
              {entry.forms.map((form) => (
                <li key={form.id}>
                  <span className={styles.formWord}>{form.word}</span> <Pronounce word={form.word} small />{' '}
                  <small>{humanize(String(form.form_of_word))}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
        {entry.base_phrasal && <Relations label={t('base_phrasal')} words={[entry.base_phrasal]} />}
        {entry.phrasal_variants && entry.phrasal_variants.length > 0 && (
          <Relations label={t('phrasal_variants')} words={entry.phrasal_variants} />
        )}
        <Origins origins={entry.origins} />
        <Origins origins={entry.contributions} contribution />
        <WordHistory locale={locale} changes={changes} t={t} />
      </div>
    </section>
  );
};
