'use client';

import React from 'react';
import {
  BulkItemT,
  BulkRequestConfigT,
  RunFailureT,
  RunProgressT,
  RunResultLineT,
  RunStatusE,
  SourceKindE,
  SourceStateT,
} from '../types';
import { RUN_COLLECT_PAGE_SIZE } from '../constants';
import { listRecords, toIdentity, toLabel, toTemplateVars } from '../sources';
import { buildRequestBody } from '../utils/renderTemplate';
import { buildHeaders, ExternalRequestError, sendExternalRequest } from '../utils/externalRequest';
import {
  MapperError,
  parseResponsePath,
  ResponsePathT,
  responseMappers,
  toResultLine,
} from '../utils/responseMappers';
import { runWithConcurrency } from '../utils/runPool';

/** Where a run takes its rows from: explicit rows, or every row of a table matching a filter */
export type RunInputT =
  | { mode: 'items'; sourceKind: SourceKindE; items: BulkItemT[] }
  | { mode: 'filter'; source: SourceStateT; total: number };

const sourceKindOf = (input: RunInputT): SourceKindE =>
  input.mode === 'items' ? input.sourceKind : input.source.kind;

const EMPTY_PROGRESS: RunProgressT = { processed: 0, total: 0, succeeded: 0, failed: 0 };
// progress is flushed to React state at most this often, a run may touch ~90k rows
const FLUSH_INTERVAL_MS = 150;

const describeError = (err: unknown): { reason: string; status?: number } => {
  if (err instanceof ExternalRequestError) return { reason: err.message, status: err.status };
  if (err instanceof MapperError) return { reason: `mapper: ${err.message}` };
  if (err instanceof SyntaxError) return { reason: `body template: ${err.message}` };
  return { reason: err instanceof Error ? err.message : String(err) };
};

/**
 * State machine of one bulk run: collects the rows, walks them with the
 * configured concurrency, keeps results and failures in memory and exposes
 * throttled progress. Results live in a ref (only their count is state) so a
 * large run does not re-render the page on every line.
 */
export const useBulkRun = () => {
  const [status, setStatus] = React.useState<RunStatusE>(RunStatusE.idle);
  const [progress, setProgress] = React.useState<RunProgressT>(EMPTY_PROGRESS);
  const [loadedRecords, setLoadedRecords] = React.useState({ loaded: 0, total: 0 });
  const [failures, setFailures] = React.useState<RunFailureT[]>([]);
  const [resultsCount, setResultsCount] = React.useState(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const resultsRef = React.useRef<RunResultLineT[]>([]);
  const failuresRef = React.useRef<RunFailureT[]>([]);
  const progressRef = React.useRef<RunProgressT>(EMPTY_PROGRESS);
  // the table of the last run, so "retry failed" maps its rows the same way
  const sourceKindRef = React.useRef<SourceKindE | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const flushTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = React.useCallback(() => {
    flushTimerRef.current = null;
    setProgress({ ...progressRef.current });
    setResultsCount(resultsRef.current.length);
    setFailures([...failuresRef.current]);
  }, []);

  const scheduleFlush = React.useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flush, FLUSH_INTERVAL_MS);
  }, [flush]);

  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    },
    [],
  );

  const collectRecords = React.useCallback(
    async (input: RunInputT, signal: AbortSignal): Promise<BulkItemT[] | null> => {
      if (input.mode === 'items') return input.items;

      const collected: BulkItemT[] = [];
      setLoadedRecords({ loaded: 0, total: input.total });
      for (let page = 1; ; page++) {
        if (signal.aborted) return null;
        const res = await listRecords(input.source, page, RUN_COLLECT_PAGE_SIZE);
        if ('error' in res) {
          setLoadError(res.message);
          return null;
        }
        collected.push(...res.items);
        setLoadedRecords({ loaded: collected.length, total: res.total });
        if (!res.has_more) break;
      }
      return collected;
    },
    [],
  );

  const processItem = React.useCallback(
    async (
      item: BulkItemT,
      sourceKind: SourceKindE,
      config: BulkRequestConfigT,
      headers: Record<string, string>,
      responsePath: ResponsePathT,
      signal: AbortSignal,
    ) => {
      const identity = toIdentity(sourceKind, item);
      try {
        const body = buildRequestBody(
          config.bodyTemplate,
          config.promptTemplate,
          toTemplateVars(sourceKind, item),
        );
        const response = await sendExternalRequest({
          url: config.url.trim(),
          headers,
          body,
          maxRetries: config.maxRetries,
          signal,
        });
        const mapped = responseMappers[config.mapper](response, responsePath);
        resultsRef.current.push(toResultLine(identity, mapped));
        progressRef.current.succeeded++;
      } catch (err) {
        // a cancelled request is not a failure of the row
        if (err instanceof ExternalRequestError && err.kind === 'aborted') return;
        const { reason, status } = describeError(err);
        failuresRef.current.push({ identity, label: toLabel(sourceKind, item), reason, status, item });
        progressRef.current.failed++;
      } finally {
        progressRef.current.processed++;
        scheduleFlush();
      }
    },
    [scheduleFlush],
  );

  const start = React.useCallback(
    async (input: RunInputT, config: BulkRequestConfigT, options: { keepResults?: boolean } = {}) => {
      if (status === RunStatusE.running || status === RunStatusE.loading_words) return;

      const controller = new AbortController();
      abortRef.current = controller;
      const sourceKind = sourceKindOf(input);
      sourceKindRef.current = sourceKind;
      setLoadError(null);
      if (!options.keepResults) resultsRef.current = [];
      failuresRef.current = [];
      progressRef.current = { ...EMPTY_PROGRESS };
      flush();

      setStatus(RunStatusE.loading_words);
      const items = await collectRecords(input, controller.signal);
      if (!items) {
        setStatus(controller.signal.aborted ? RunStatusE.cancelled : RunStatusE.idle);
        return;
      }

      progressRef.current = { ...EMPTY_PROGRESS, total: items.length };
      flush();
      setStatus(RunStatusE.running);

      const headers = buildHeaders(config);
      // an invalid path is blocked by the form; fall back to auto-detection just in case
      const responsePath = parseResponsePath(config.responsePath) ?? [];
      await runWithConcurrency(
        items,
        (item) => processItem(item, sourceKind, config, headers, responsePath, controller.signal),
        { concurrency: config.concurrency, signal: controller.signal },
      );

      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flush();
      setStatus(controller.signal.aborted ? RunStatusE.cancelled : RunStatusE.done);
    },
    [status, collectRecords, processItem, flush],
  );

  const cancel = React.useCallback(() => abortRef.current?.abort(), []);

  const retryFailed = React.useCallback(
    (config: BulkRequestConfigT) => {
      const sourceKind = sourceKindRef.current;
      if (!sourceKind) return Promise.resolve();
      const items = failuresRef.current.map((f) => f.item);
      return start({ mode: 'items', sourceKind, items }, config, { keepResults: true });
    },
    [start],
  );

  const getResults = React.useCallback(() => resultsRef.current, []);
  const getFailures = React.useCallback(() => failuresRef.current, []);

  return {
    status,
    progress,
    loadedRecords,
    failures,
    resultsCount,
    loadError,
    start,
    cancel,
    retryFailed,
    getResults,
    getFailures,
  };
};
