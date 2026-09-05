'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { EnSearchWordT, PublicSearchV1ResT } from 'server/types';

import { browserApiBase } from '@/core/apiBase';
import { Link } from '@/i18n/navigation';

import styles from './styles.module.scss';

type StateT =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; items: EnSearchWordT[]; fuzzy: boolean }
  | { kind: 'error' };

// the search term travels in ?q= so a search can be shared and reloaded
// (issue #399); replaceState keeps the URL in sync without history spam
const syncUrl = (query: string) => {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  window.history.replaceState(null, '', url);
};

/** A search box over POST /api/v1/search; every hit links to its word page */
export const WordSearch = ({ initialTerm = '' }: { initialTerm?: string }) => {
  const t = useTranslations('word');
  const [term, setTerm] = useState(initialTerm);
  const [state, setState] = useState<StateT>({ kind: 'idle' });

  const runSearch = async (query: string) => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`${browserApiBase()}/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: query, limit: 20 }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { data, meta } = (await res.json()) as PublicSearchV1ResT;
      setState({ kind: 'results', items: data, fuzzy: meta.fuzzy });
    } catch {
      setState({ kind: 'error' });
    }
  };

  // an opened link with ?q= restores the search (read client-side: the page
  // may be statically prerendered, so the query string only exists here)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('q')?.trim();
    if (!query) return;
    setTerm(query);
    void runSearch(query);
    // runs once on mount by design
  }, []);

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    syncUrl(query);
    void runSearch(query);
  };

  return (
    <div>
      <form className={styles.form} onSubmit={search} role="search">
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('search_placeholder')}
          aria-label={t('search_label')}
        />
        <button type="submit" disabled={state.kind === 'loading' || !term.trim()}>
          {t('search_button')}
        </button>
      </form>
      {state.kind === 'results' && state.items.length === 0 && (
        <p className={styles.note}>{t('search_empty')}</p>
      )}
      {state.kind === 'results' && state.fuzzy && state.items.length > 0 && (
        <p className={styles.note}>{t('search_fuzzy')}</p>
      )}
      {state.kind === 'error' && <p className={styles.note}>{t('search_error')}</p>}
      {state.kind === 'results' && state.items.length > 0 && (
        <ul className={styles.results}>
          {state.items.map((item) => (
            <li key={item.id}>
              <Link href={`/word/${encodeURIComponent(item.word)}`}>{item.word}</Link>
              <small>{item.part_of_speech}</small>
              {item.transcription && <small>/{item.transcription.replace(/^[/[]|[/\]]$/g, '')}/</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
