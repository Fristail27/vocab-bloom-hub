'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useTranslationLanguage } from '@/app/[locale]/word/[word]/_components/TranslationLanguage';
import { buildWordGraph, entriesForPart, GraphEntryT, wordNodeId } from '@/core/wordGraph';
import { loadGraphNeighbor } from '@/core/wordGraphClient';
import { Link } from '@/i18n/navigation';

import { GraphCanvas } from './Canvas';
import styles from './styles.module.scss';

type GraphP = { word: string; dataset: string; entries: GraphEntryT[] };
type LoadStateT = 'loading' | 'loaded' | 'empty' | 'failed';

const Explorer = ({
  word,
  dataset,
  entries,
  partOfSpeech,
  translationLanguage,
}: GraphP & { partOfSpeech: string; translationLanguage?: string }) => {
  const t = useTranslations('graph');
  const [neighbors, setNeighbors] = useState<Map<string, GraphEntryT[]>>(new Map());
  const [states, setStates] = useState<Map<string, LoadStateT>>(new Map());
  const [selected, setSelected] = useState('');
  const pending = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const requests = pending.current;
    return () => {
      requests.forEach((request) => request.abort());
      requests.clear();
    };
  }, []);
  const graph = useMemo(
    () => buildWordGraph(word, entries, partOfSpeech, neighbors, translationLanguage),
    [word, entries, partOfSpeech, neighbors, translationLanguage],
  );
  const selectedNode = graph.nodes.find((node) => node.id === selected);
  const load = async (related: string) => {
    if (
      dataset === 'active' ||
      !graph.direct.includes(related) ||
      neighbors.has(related) ||
      pending.current.has(related)
    )
      return;
    // Human-triggered expansion only, with a small concurrency limit.
    if (pending.current.size >= 3) return;
    const controller = new AbortController();
    pending.current.set(related, controller);
    setStates((value) => new Map(value).set(related, 'loading'));
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const loaded = entriesForPart(await loadGraphNeighbor(related, dataset, controller.signal), partOfSpeech);
      if (!pending.current.has(related)) return;
      setNeighbors((value) => new Map(value).set(related, loaded));
      setStates((value) => new Map(value).set(related, loaded.length ? 'loaded' : 'empty'));
    } catch {
      if (pending.current.has(related)) setStates((value) => new Map(value).set(related, 'failed'));
    } finally {
      clearTimeout(timer);
      pending.current.delete(related);
    }
  };
  const select = (id: string) => {
    setSelected(id);
    const direct = graph.direct.find((related) => wordNodeId(related) === id);
    if (direct) void load(direct);
  };
  const state = selectedNode?.kind === 'word' ? states.get(selectedNode.label) : undefined;
  const canExpand =
    selectedNode?.kind === 'word' && graph.direct.includes(selectedNode.label) && dataset !== 'active';
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return (
    <div
      className={styles.explorer}
      data-testid="word-graph"
      data-dataset={dataset}
      data-part-of-speech={partOfSpeech}
    >
      <p className={styles.hint}>{t(translationLanguage === undefined ? 'hint' : 'translations_hint')}</p>
      <div className={styles.legend}>
        <span className={styles.meaning}>{t('meaning')}</span>
        {translationLanguage === undefined ? (
          <>
            <span className={styles.synonym}>{t('synonym')}</span>
            <span className={styles.antonym}>{t('antonym')}</span>
          </>
        ) : (
          <span className={styles.meaning}>{t('translation')}</span>
        )}
        <span className={styles.shared}>{t('shared')}</span>
      </div>
      <GraphCanvas
        graph={graph}
        selected={selected}
        onSelect={select}
        label={t(translationLanguage === undefined ? 'canvas' : 'translations_canvas')}
        zoomIn={t('zoom_in')}
        zoomOut={t('zoom_out')}
        reset={t('reset')}
      />
      <div className={styles.selection}>
        <label>
          {t('select')}
          <select value={selected} onChange={(event) => select(event.target.value)}>
            <option value="">{t('all')}</option>
            {graph.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.kind === 'meaning' ? `${t('meaning')}: ` : ''}
                {node.label}
              </option>
            ))}
          </select>
        </label>
        {selectedNode && (
          <p className={styles.detail} lang={selectedNode.language ?? 'en'} dir="auto">
            {selectedNode.detail}
          </p>
        )}
        {selectedNode?.kind === 'word' && selectedNode.depth > 0 && (
          <Link href={`/word/${encodeURIComponent(selectedNode.label)}`}>{t('open_word')}</Link>
        )}
        {canExpand && state !== 'loaded' && state !== 'empty' && (
          <button type="button" disabled={state === 'loading'} onClick={() => void load(selectedNode.label)}>
            {t(state === 'failed' ? 'retry' : state === 'loading' ? 'loading' : 'expand')}
          </button>
        )}
        <span role="status">{state ? t(state) : ''}</span>
      </div>
      {graph.truncated && <p className={styles.hint}>{t('limited')}</p>}
      {translationLanguage === undefined && dataset === 'active' && (
        <p className={styles.hint}>{t('unnamed')}</p>
      )}
      {!graph.edges.some((edge) => edge.kind !== 'meaning') && (
        <p>{t(translationLanguage === undefined ? 'no_relations' : 'no_translations')}</p>
      )}
      <details className={styles.list}>
        <summary>{t('list')}</summary>
        <ul>
          {graph.edges.map((edge) => (
            <li key={JSON.stringify(edge)}>
              <bdi lang="en">{byId.get(edge.from)?.label}</bdi>
              {' — '}
              {t(edge.kind)}
              {' → '}
              <button type="button" onClick={() => select(edge.to)}>
                <bdi lang={byId.get(edge.to)?.language ?? 'en'}>{byId.get(edge.to)?.label}</bdi>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};

const GraphModes = (props: GraphP & { partOfSpeech: string }) => {
  const t = useTranslations('graph');
  const language = useTranslationLanguage() ?? '';
  const id = useId();
  const modes = ['relations', 'translations'] as const;
  const [mode, setMode] = useState<(typeof modes)[number]>('relations');
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const index = modes.indexOf(mode);
    const next = {
      [rtl ? 'ArrowLeft' : 'ArrowRight']: (index + 1) % modes.length,
      [rtl ? 'ArrowRight' : 'ArrowLeft']: (index - 1 + modes.length) % modes.length,
      Home: 0,
      End: modes.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setMode(modes[next]);
    document.getElementById(`${id}-tab-${modes[next]}`)?.focus();
  };
  return (
    <>
      <div className={styles.modes} role="tablist" aria-label={t('view')} onKeyDown={onKeyDown}>
        {modes.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            id={`${id}-tab-${item}`}
            aria-selected={mode === item}
            aria-controls={`${id}-panel`}
            tabIndex={mode === item ? 0 : -1}
            onClick={() => setMode(item)}
          >
            {t(item)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${mode}`}>
        <Explorer
          key={mode === 'translations' ? `${mode}:${language}` : mode}
          {...props}
          translationLanguage={mode === 'translations' ? language : undefined}
        />
      </div>
    </>
  );
};

const PartGraphs = (props: GraphP) => {
  const t = useTranslations('graph');
  const id = useId();
  const parts = [...new Set(props.entries.map((entry) => entry.part_of_speech))];
  const [chosen, setChosen] = useState(parts[0]);
  const selected = parts.includes(chosen) ? chosen : parts[0];
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const index = parts.indexOf(selected);
    const next = {
      [rtl ? 'ArrowLeft' : 'ArrowRight']: (index + 1) % parts.length,
      [rtl ? 'ArrowRight' : 'ArrowLeft']: (index - 1 + parts.length) % parts.length,
      Home: 0,
      End: parts.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setChosen(parts[next]);
    document.getElementById(`${id}-tab-${parts[next]}`)?.focus();
  };
  return (
    <>
      <div className={styles.parts} role="tablist" aria-label={t('parts')} onKeyDown={onKeyDown}>
        {parts.map((part) => (
          <button
            key={part}
            type="button"
            role="tab"
            id={`${id}-tab-${part}`}
            aria-selected={part === selected}
            aria-controls={`${id}-panel`}
            tabIndex={part === selected ? 0 : -1}
            onClick={() => setChosen(part)}
          >
            <bdi lang="en">{part.replace(/_/g, ' ')}</bdi>
          </button>
        ))}
      </div>
      {selected && (
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`}>
          <GraphModes key={selected} {...props} partOfSpeech={selected} />
        </div>
      )}
    </>
  );
};

/** Mounted only when opened; a separate instance and request cache for each dataset. */
export const WordGraph = (props: GraphP) => {
  const t = useTranslations('graph');
  const [open, setOpen] = useState(false);
  return (
    <details className={styles.graph} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t('title')}</summary>
      {open && <PartGraphs key={`${props.dataset}:${props.word}`} {...props} />}
    </details>
  );
};
