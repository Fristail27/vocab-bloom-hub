'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  PublicDatasetsV1ResT,
  PublicSemanticSearchV1ResT,
  PublicSearchDatasetsV1ResT,
  PublicSearchWordV1T,
  PublicSearchV1ResT,
} from 'server/types';
import { MAX_SEARCH_DATASETS } from 'server/core/constants/datasets';

import { browserApiBase } from '@/core/apiBase';
import { Link } from '@/i18n/navigation';

import styles from './styles.module.scss';

type StateT =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; items: PublicSearchWordV1T[]; fuzzy: boolean; dataset?: string }
  | { kind: 'groups'; response: PublicSearchDatasetsV1ResT; query: string }
  | { kind: 'semantic'; response: PublicSemanticSearchV1ResT }
  | { kind: 'semantic_error' }
  | { kind: 'error' };
type SearchModeT = 'spelling' | 'meaning';

const syncUrl = (query: string, datasets: string[], mode: SearchModeT) => {
  const url = new URL(window.location.href);
  if (mode === 'meaning') url.searchParams.set('mode', 'meaning');
  else url.searchParams.delete('mode');
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  url.searchParams.delete('dataset');
  url.searchParams.delete('datasets');
  datasets.forEach((name) => url.searchParams.append(datasets.length === 1 ? 'dataset' : 'datasets', name));
  window.history.replaceState(null, '', url);
};

/** A selected search keeps each dictionary's results and links attributable to that dataset. */
export const WordSearch = ({ initialTerm = '' }: { initialTerm?: string }) => {
  const t = useTranslations('word');
  const [term, setTerm] = useState(initialTerm);
  const [mode, setMode] = useState<SearchModeT>('spelling');
  const [semanticEnabled, setSemanticEnabled] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [inventory, setInventory] = useState<PublicDatasetsV1ResT['data'] | null>(null);
  const [inventoryError, setInventoryError] = useState(false);
  const inventoryLoading = useRef(false);
  const [state, setState] = useState<StateT>({ kind: 'idle' });
  const [paging, setPaging] = useState(false);
  const requestId = useRef(0);

  const loadDatasets = async () => {
    if (inventory || inventoryLoading.current) return;
    inventoryLoading.current = true;
    setInventoryError(false);
    try {
      const res = await fetch(`${browserApiBase()}/v1/datasets`);
      if (!res.ok) throw new Error(String(res.status));
      setInventory(((await res.json()) as PublicDatasetsV1ResT).data);
    } catch {
      setInventoryError(true);
    } finally {
      inventoryLoading.current = false;
    }
  };

  const runSearch = async (query: string, names: string[], searchMode: SearchModeT = 'spelling') => {
    const id = ++requestId.current;
    setState({ kind: 'loading' });
    try {
      if (searchMode === 'meaning') {
        if (names.length > 1) throw new Error('one dataset required');
        const params = new URLSearchParams({ query, limit: '20' });
        if (names[0]) params.set('dataset', names[0]);
        const res = await fetch(`${browserApiBase()}/v1/search/semantic?${params}`);
        if (!res.ok) throw new Error(String(res.status));
        const response = (await res.json()) as PublicSemanticSearchV1ResT;
        if (id === requestId.current) setState({ kind: 'semantic', response });
        return;
      }
      const params = new URLSearchParams({ search: query, limit: '20' });
      names.forEach((name) => params.append(names.length > 1 ? 'datasets' : 'dataset', name));
      const res = await fetch(`${browserApiBase()}/v1/search${names.length > 1 ? '/datasets' : ''}?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      if (names.length > 1) {
        const response = (await res.json()) as PublicSearchDatasetsV1ResT;
        if (id === requestId.current) setState({ kind: 'groups', response, query });
      } else {
        const { data, meta } = (await res.json()) as PublicSearchV1ResT;
        const dataset = meta.dataset ?? names[0] ?? res.headers?.get('X-Dataset') ?? undefined;
        if (id === requestId.current) setState({ kind: 'results', items: data, fuzzy: meta.fuzzy, dataset });
      }
    } catch {
      if (id === requestId.current) setState({ kind: searchMode === 'meaning' ? 'semantic_error' : 'error' });
    }
  };

  useEffect(() => {
    let alive = true;
    const restoredRequest = requestId.current;
    const params = new URLSearchParams(window.location.search);
    const names = params.has('datasets') ? params.getAll('datasets') : params.getAll('dataset');
    const restoredMode = params.get('mode') === 'meaning' ? 'meaning' : 'spelling';
    setMode(restoredMode);
    setSelected(names);
    const query = params.get('q')?.trim();
    if (query) {
      setTerm(query);
      if (restoredMode === 'spelling') void runSearch(query, names);
    }
    // One server flag controls both API and UI, including already-built images.
    // No model request is made by this capability read.
    void fetch(`${browserApiBase()}/v1/search/semantic/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
      .then(async (res) => res.ok && (await res.json()).data?.enabled === true)
      .catch(() => false)
      .then((enabled) => {
        if (!alive) return;
        setSemanticEnabled(enabled);
        if (restoredMode === 'meaning' && requestId.current === restoredRequest) {
          if (!enabled || names.length > 1) setState({ kind: 'semantic_error' });
          else if (query) void runSearch(query, names, 'meaning');
        }
      });
    return () => {
      alive = false;
      requestId.current++;
    };
    // Read once on mount: this page can be statically prerendered.
  }, []);

  const changeMode = (next: SearchModeT) => {
    requestId.current++;
    setMode(next);
    setState({ kind: 'idle' });
    syncUrl(term.trim(), selected, next);
  };

  const choose = (names: string[]) => {
    setSelected(names);
    syncUrl(term.trim(), names, mode);
  };

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (!query || state.kind === 'loading' || paging) return;
    syncUrl(query, selected, mode);
    if (mode === 'meaning' && !semanticEnabled) {
      requestId.current++;
      setState({ kind: 'semantic_error' });
      return;
    }
    void runSearch(query, selected, mode);
  };

  const pageGroup = async (dataset: string, page: number) => {
    if (state.kind !== 'groups' || paging) return;
    const id = requestId.current;
    setPaging(true);
    try {
      const params = new URLSearchParams({
        search: state.query,
        datasets: dataset,
        limit: '20',
        page: String(page),
      });
      const res = await fetch(`${browserApiBase()}/v1/search/datasets?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const response = (await res.json()) as PublicSearchDatasetsV1ResT;
      if (id === requestId.current)
        setState({
          ...state,
          response: {
            data: state.response.data.map((group) => (group.dataset === dataset ? response.data[0] : group)),
            meta: {
              ...state.response.meta,
              partial:
                response.meta.partial ||
                state.response.data.some((g) => g.dataset !== dataset && g.status === 'unavailable'),
            },
          },
        });
    } catch {
      // A closed target must not linger in a previously successful group.
      if (id === requestId.current) setState({ kind: 'error' });
    } finally {
      setPaging(false);
    }
  };

  const count =
    state.kind === 'results'
      ? state.items.length
      : state.kind === 'semantic'
        ? state.response.data.length
        : state.kind === 'groups'
          ? state.response.data.reduce((sum, g) => sum + (g.status === 'ok' ? g.data.length : 0), 0)
          : 0;
  const status =
    state.kind === 'loading' || paging
      ? t('search_loading')
      : state.kind === 'semantic_error'
        ? t('semantic_unavailable')
        : state.kind === 'error'
          ? t('search_error')
          : state.kind === 'results' || state.kind === 'groups' || state.kind === 'semantic'
            ? [
                count === 0
                  ? state.kind === 'groups' && state.response.meta.partial
                    ? ''
                    : t('search_empty')
                  : t('search_results', { count }),
                state.kind === 'results' && state.fuzzy ? t('search_fuzzy') : '',
                state.kind === 'groups' && state.response.meta.partial ? t('search_partial') : '',
              ]
                .filter(Boolean)
                .join(' ')
            : '';

  const results = (items: PublicSearchWordV1T[], dataset?: string) => (
    <ul className={styles.results}>
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/word/${encodeURIComponent(item.word)}${dataset ? `?dataset=${encodeURIComponent(dataset)}` : ''}`}
          >
            {item.word}
          </Link>
          <small>{item.part_of_speech}</small>
          {item.transcription && <small>/{item.transcription.replace(/^[/[]|[/\]]$/g, '')}/</small>}
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <form onSubmit={search} role="search" aria-busy={state.kind === 'loading' || paging}>
        {(semanticEnabled || mode === 'meaning') && (
          <fieldset className={styles.modes} disabled={state.kind === 'loading' || paging}>
            <legend>{t('search_mode')}</legend>
            <label>
              <input
                type="radio"
                name="search-mode"
                checked={mode === 'spelling'}
                onChange={() => changeMode('spelling')}
              />
              {t('search_by_spelling')}
            </label>
            {semanticEnabled && (
              <label>
                <input
                  type="radio"
                  name="search-mode"
                  checked={mode === 'meaning'}
                  disabled={selected.length > 1}
                  onChange={() => changeMode('meaning')}
                />
                {t('search_by_meaning')}
              </label>
            )}
          </fieldset>
        )}
        {semanticEnabled && (
          <p className={styles.note}>{t(mode === 'meaning' ? 'semantic_hint' : 'semantic_dataset_hint')}</p>
        )}
        <div className={styles.form}>
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t(mode === 'meaning' ? 'semantic_placeholder' : 'search_placeholder')}
            aria-label={t(mode === 'meaning' ? 'semantic_label' : 'search_label')}
            maxLength={mode === 'meaning' ? 1000 : undefined}
          />
          <button
            type="submit"
            disabled={!term.trim()}
            aria-disabled={state.kind === 'loading' || paging || !term.trim()}
          >
            {t('search_button')}
          </button>
        </div>
        <details
          className={styles.datasets}
          onToggle={(event) => {
            if (event.currentTarget.open) void loadDatasets();
          }}
        >
          <summary>
            {t('search_datasets')}
            {selected.length > 0 ? ` (${selected.length})` : ''}
          </summary>
          <p>
            {mode === 'meaning'
              ? t('semantic_dataset_hint')
              : t('search_dataset_hint', { count: MAX_SEARCH_DATASETS })}
          </p>
          {inventoryError ? (
            <p>
              {t('search_error')}{' '}
              <button type="button" onClick={() => void loadDatasets()}>
                {t('search_retry')}
              </button>
            </p>
          ) : !inventory ? (
            <p>{t('search_loading')}</p>
          ) : (
            <fieldset disabled={state.kind === 'loading' || paging}>
              <legend>{t('search_datasets')}</legend>
              <label>
                <input
                  type={mode === 'meaning' ? 'radio' : 'checkbox'}
                  name="search-dataset"
                  checked={selected.length === 0}
                  onChange={() => choose([])}
                />
                {t('search_active_dataset')}
              </label>
              {inventory.map((dataset) => (
                <label key={dataset.dataset}>
                  <input
                    type={mode === 'meaning' ? 'radio' : 'checkbox'}
                    name="search-dataset"
                    checked={selected.includes(dataset.dataset)}
                    disabled={
                      mode !== 'meaning' &&
                      !selected.includes(dataset.dataset) &&
                      selected.length >= MAX_SEARCH_DATASETS
                    }
                    onChange={(event) =>
                      choose(
                        event.target.checked
                          ? mode === 'meaning'
                            ? [dataset.dataset]
                            : [...selected, dataset.dataset]
                          : selected.filter((name) => name !== dataset.dataset),
                      )
                    }
                  />
                  {dataset.title ?? dataset.dataset}
                </label>
              ))}
            </fieldset>
          )}
        </details>
      </form>
      <p className={styles.note} role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
      {state.kind === 'results' && state.items.length > 0 && results(state.items, state.dataset)}
      {state.kind === 'semantic' && (
        <section className={styles.group} aria-label={t('semantic_results')}>
          <h2>{t('semantic_results')}</h2>
          <p>
            {state.response.meta.dataset.title ?? state.response.meta.dataset.dataset} ·{' '}
            {state.response.meta.dataset.attribution} · {state.response.meta.dataset.license}
          </p>
          <ul className={styles.meanings}>
            {state.response.data.map(({ word, meaning }) => (
              <li key={meaning.id}>
                <Link
                  href={`/word/${encodeURIComponent(word.word)}?dataset=${encodeURIComponent(state.response.meta.dataset.dataset)}`}
                >
                  {word.word}
                </Link>{' '}
                <small>{word.part_of_speech}</small>
                <p>
                  <strong>{meaning.title}</strong>
                </p>
                <p>{meaning.definition}</p>
                {meaning.modified && <small>{t('semantic_modified')}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {state.kind === 'groups' &&
        state.response.data.map((group) => (
          <section className={styles.group} key={group.dataset} aria-label={group.title ?? group.dataset}>
            <h2>{group.title ?? group.dataset}</h2>
            <p>
              {group.attribution} · {group.license}
            </p>
            {group.status === 'unavailable' ? (
              <p>{t('search_group_unavailable')}</p>
            ) : (
              <>
                {group.meta.fuzzy && <p>{t('search_fuzzy')}</p>}
                {group.data.length ? results(group.data, group.dataset) : <p>{t('search_empty')}</p>}
                {(group.meta.page > 1 || group.meta.has_more) && (
                  <nav
                    className={styles.paging}
                    aria-label={t('search_group_pages', { dataset: group.title ?? group.dataset })}
                  >
                    <button
                      type="button"
                      disabled={paging || group.meta.page <= 1}
                      onClick={() => void pageGroup(group.dataset, group.meta.page - 1)}
                    >
                      {t('search_previous')}
                    </button>
                    <span>{t('search_page', { page: group.meta.page })}</span>
                    <button
                      type="button"
                      disabled={paging || !group.meta.has_more || group.meta.page >= 20}
                      onClick={() => void pageGroup(group.dataset, group.meta.page + 1)}
                    >
                      {t('search_next')}
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        ))}
    </div>
  );
};
