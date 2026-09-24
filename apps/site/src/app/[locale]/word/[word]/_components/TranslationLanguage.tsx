'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

import { flagOf } from '@/core/languageFlags';

import styles from '../../word.module.scss';

// One translation language at a time on a word page (issue #520): the
// reader's own language by default, any other the headword has on a click;
// the choice is kept for the next page. Every translation is in the HTML,
// the ones of the other languages hidden — a crawler reads them all, a
// reader sees one

type ContextT = { selected: string | null; available: string[]; select: (language: string) => void };

const Context = createContext<ContextT>({ selected: null, available: [], select: () => {} });

const STORAGE_KEY = 'vbh.site.translation-language';

const readChoice = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const keepChoice = (language: string): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // a private window or blocked storage: the choice lives until the page unloads
  }
};

type ProviderP = {
  /** The languages this headword translates into, in the order of the picker */
  available: string[];
  /** What the server renders visible: the locale's language when it is among them, else the first */
  defaultLanguage: string | null;
  children: React.ReactNode;
};

export const TranslationLanguageProvider = ({ available, defaultLanguage, children }: ProviderP) => {
  const [selected, setSelected] = useState(defaultLanguage);

  useEffect(() => {
    const kept = readChoice();
    if (kept && available.includes(kept)) setSelected(kept);
  }, [available]);

  const select = (language: string) => {
    setSelected(language);
    keepChoice(language);
  };

  return <Context.Provider value={{ selected, available, select }}>{children}</Context.Provider>;
};

/** The flags of the languages a headword has; the chosen one pressed */
export const TranslationPicker = ({ label }: { label: string }) => {
  const { selected, available, select } = useContext(Context);
  if (available.length < 2) return null;

  return (
    <div className={styles.picker} role="group" aria-label={label}>
      {available.map((language) => (
        <button
          key={language}
          type="button"
          className={language === selected ? styles.flagActive : styles.flag}
          aria-pressed={language === selected}
          title={language}
          onClick={() => select(language)}
        >
          <span aria-hidden="true">{flagOf(language)}</span>
          <span className={styles.flagCode}>{language}</span>
        </button>
      ))}
    </div>
  );
};

type ForLanguageP = { language: string; as?: 'span' | 'li'; className?: string; children: React.ReactNode };

/** A translation, shown when its language is the chosen one */
export const ForLanguage = ({ language, as: Tag = 'span', className, children }: ForLanguageP) => {
  const { selected } = useContext(Context);

  return (
    <Tag className={className} lang={language} dir="auto" hidden={language !== selected}>
      {children}
    </Tag>
  );
};
