'use client';

import React, { useEffect, useId, useState } from 'react';

import styles from '../api.module.scss';

export type SnippetItemT = {
  id: string;
  label: string;
  /** The code as highlighted HTML (content/highlight.ts); already escaped */
  html: string;
};

type SnippetsP = { items: SnippetItemT[]; title: string };

// The reader's language, shared by every endpoint of the page and kept for
// the next visit; a page renders the first tab until the browser applies it
const STORAGE_KEY = 'vbh.site.snippet-language';

const readChoice = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const keepChoice = (id: string): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // a private window or blocked storage: the choice lives until the page unloads
  }
};

// every Snippets on the page follows one choice: a change is announced to the others
const CHANGE_EVENT = 'vbh:snippet-language';

/**
 * The request of an endpoint in several languages (content/snippets): tabs
 * over pre-highlighted code. Without JavaScript the first language shows.
 */
export const Snippets = ({ items, title }: SnippetsP) => {
  const baseId = useId();
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const apply = (id: string | null) => {
      if (id && items.some((item) => item.id === id)) setActive(id);
    };
    apply(readChoice());
    const onChange = (event: Event) => apply((event as CustomEvent<string>).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [items]);

  const choose = (id: string) => {
    setActive(id);
    keepChoice(id);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: id }));
  };

  if (items.length === 0) return null;

  return (
    <div className={styles.snippets}>
      <div role="tablist" aria-label={title} className={styles.tabs}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.id}`}
            aria-selected={item.id === active}
            aria-controls={`${baseId}-panel-${item.id}`}
            className={item.id === active ? styles.tabActive : styles.tab}
            onClick={() => choose(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <pre
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          className={styles.pre}
          data-language={item.id}
        >
          {/* highlight.js output: escaped text in span tokens */}
          <code dangerouslySetInnerHTML={{ __html: item.html }} />
        </pre>
      ))}
    </div>
  );
};
