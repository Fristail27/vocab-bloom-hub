'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  PublicDatasetsV1ResT,
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
  | { kind: 'error' };

const syncUrl = (query: string, datasets: string[]) => {
  const url = new URL(window.location.href);
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

  const runSearch = async (query: string, names: string[]) => {
    const id = ++requestId.current;
    setState({ kind: 'loading' });
    try {
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
      if (id === requestId.current) setState({ kind: 'error' });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const names = params.has('datasets') ? params.getAll('datasets') : params.getAll('dataset');
    setSelected(names);
    const query = params.get('q')?.trim();
    if (query) {
      setTerm(query);
      void runSearch(query, names);
    }
    return () => {
      requestId.current++;
    };
    // Read once on mount: this page can be statically prerendered.
  }, []);

  const choose = (names: string[]) => {
    setSelected(names);
    syncUrl(term.trim(), names);
  };

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (!query || state.kind === 'loading' || paging) return;
    syncUrl(query, selected);
    void runSearch(query, selected);
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
      : state.kind === 'groups'
        ? state.response.data.reduce((sum, g) => sum + (g.status === 'ok' ? g.data.length : 0), 0)
        : 0;
  const status =
    state.kind === 'loading' || paging
      ? t('search_loading')
      : state.kind === 'error'
        ? t('search_error')
        : state.kind === 'results' || state.kind === 'groups'
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
        <div className={styles.form}>
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('search_placeholder')}
            aria-label={t('search_label')}
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
          <p>{t('search_dataset_hint', { count: MAX_SEARCH_DATASETS })}</p>
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
                <input type="checkbox" checked={selected.length === 0} onChange={() => choose([])} />
                {t('search_active_dataset')}
              </label>
              {inventory.map((dataset) => (
                <label key={dataset.dataset}>
                  <input
                    type="checkbox"
                    checked={selected.includes(dataset.dataset)}
                    disabled={!selected.includes(dataset.dataset) && selected.length >= MAX_SEARCH_DATASETS}
                    onChange={(event) =>
                      choose(
                        event.target.checked
                          ? [...selected, dataset.dataset]
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
