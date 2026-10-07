'use client';

import React, { createContext, useContext, useSyncExternalStore } from 'react';

import { Flag } from '@/components/Flag';

import styles from '../../word.module.scss';

// One translation language at a time on a word page (issue #520): the
// reader's own language by default, any other the headword has on a click;
// the choice is kept for the next page. Every translation is in the HTML,
// the ones of the other languages hidden — a crawler reads them all, a
// reader sees one

type ContextT = { selected: string | null; available: string[]; select: (language: string) => void };

const Context = createContext<ContextT>({ selected: null, available: [], select: () => {} });

export const useTranslationLanguage = (): string | null => useContext(Context).selected;

const STORAGE_KEY = 'vbh.site.translation-language';

// The choice is one for the page, and a page has a picker per dataset (issue
// #538): every picker reads it from here and hears when another one sets it
const listeners = new Set<() => void>();
// a private window or blocked storage: the choice lives until the page unloads
let unsaved: string | null = null;

const readChoice = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? unsaved;
  } catch {
    return unsaved;
  }
};

const keepChoice = (language: string): void => {
  unsaved = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // kept in `unsaved`
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  // the choice made on a page in another tab of the browser
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

// the server knows no choice: it renders the default, the browser takes over after hydration
const noChoice = (): null => null;

type ProviderP = {
  /** The languages this headword translates into, in the order of the picker */
  available: string[];
  /** What the server renders visible: the locale's language when it is among them, else the first */
  defaultLanguage: string | null;
  children: React.ReactNode;
};

export const TranslationLanguageProvider = ({ available, defaultLanguage, children }: ProviderP) => {
  const choice = useSyncExternalStore(subscribe, readChoice, noChoice);
  const selected = choice && available.includes(choice) ? choice : defaultLanguage;

  return <Context.Provider value={{ selected, available, select: keepChoice }}>{children}</Context.Provider>;
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
          <Flag language={language} decorative />
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
