import { Origins } from '@/components/Origins';
import { useTranslations } from 'next-intl';
import React from 'react';
import type { PublicChangeV1T } from 'server/types';

import { ReportMistake } from '@/components/ReportMistake';
import { WordGraph } from '@/components/WordGraph';
import { licenseLabel } from '@/core/datasetTerms';
import { graphEntries } from '@/core/wordGraph';
import { changesOfEntry } from '@/core/wordHistory';
import { localeTranslations, translationLanguages } from '@/core/wordPage';
import type { WordPanelT } from '@/core/wordPanel';

import styles from '../../word.module.scss';
import { DatasetNote } from './DatasetNote';
import { Entry, WordLink } from './Entry';
import { TranslationLanguageProvider, TranslationPicker } from './TranslationLanguage';
import type { TranslateT } from './translate';

type PanelP = {
  panel: WordPanelT;
  /** What was changed on the instance in the entries of the panel (issue #531) */
  history: PublicChangeV1T[];
  locale: string;
  /** The messages of the word page, of the page of the terms — the names of the facts of a dataset — and the label of the languages */
  t: TranslateT;
  termsNames: TranslateT;
  languageLabel: string;
};

/**
 * A dataset's own account of the headword (issue #538): the terms it comes
 * under, its translations, spellings and entries. One component for both
 * sides: the server renders the panel a page opens, the browser the panel
 * of a tab that was pressed.
 */
export const Panel = ({ panel, history, locale, t, termsNames, languageLabel }: PanelP) => {
  const p = useTranslations('provenance');
  const { entries, terms } = panel;
  // the other spellings of the headword, but for the ones the panel itself shows the entries of
  const shown = new Set(entries.map((entry) => entry.word));
  const variants = panel.variants.filter((variant) => !shown.has(variant));
  // the locale's translations on the first screen, before the entries
  const translations = localeTranslations(entries, locale);
  // a correction takes the license of the data it corrects (issue #527)
  const license = licenseLabel(terms.license);
  // one translation language at a time (issue #520): the locale's own when the headword has it, else the first
  const languages = translationLanguages(entries, locale);
  const ownLanguage = locale === 'en' ? null : locale;
  const defaultLanguage = ownLanguage && languages.includes(ownLanguage) ? ownLanguage : (languages[0] ?? null);

  return (
    <TranslationLanguageProvider available={languages} defaultLanguage={defaultLanguage}>
      <DatasetNote panel={panel} t={t} terms={termsNames} />
      {terms.description && (
        <p>
          <strong>{p('description')}: </strong>
          {terms.description}
        </p>
      )}
      <Origins origins={terms.origins} title={p('dataset_sources')} />
      {translations.length > 0 && (
        <p className={styles.lead}>
          <span className={styles.leadLabel}>{t('translation_label')}:</span>{' '}
          <span lang={locale} dir="auto">
            {translations.join(', ')}
          </span>
        </p>
      )}
      {/* the words the dictionary spells the same but for the case: each is a page of its own */}
      {variants.length > 0 && (
        <p className={styles.variants} data-testid="other-spellings">
          {t('other_spellings')}:{' '}
          {variants.map((variant) => (
            <WordLink key={variant} word={variant} />
          ))}
        </p>
      )}
      <div className={styles.metaRow}>
        <div className={styles.metaLeft}>
          <p className={styles.meta}>{t('entries', { count: entries.length })}</p>
          <TranslationPicker label={languageLabel} />
        </div>
        {/* a report goes to the queue of the served dataset: its entries only */}
        {panel.active && (
          <ReportMistake
            headword={panel.word}
            license={license}
            entries={entries.map((entry) => ({
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
        )}
      </div>
      <WordGraph
        key={`${panel.dataset}:${panel.word}`}
        word={panel.word}
        dataset={panel.dataset}
        entries={graphEntries(entries)}
      />
      {entries.map((entry) => (
        <Entry
          key={entry.id}
          entry={entry}
          headword={panel.word}
          changes={changesOfEntry(history, entry)}
          locale={locale}
          t={t}
        />
      ))}
    </TranslationLanguageProvider>
  );
};
