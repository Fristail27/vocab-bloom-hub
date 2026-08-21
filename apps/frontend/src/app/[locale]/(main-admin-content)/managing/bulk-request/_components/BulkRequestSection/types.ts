import {
  EnMeaningListItemT,
  EnMeaningTranslationListItemT,
  EnWordListItemT,
  ListMeaningsQueryT,
  ListMeaningTranslationsQueryT,
  ListWordsQueryT,
} from 'server/types';

/** Which dictionary table a run walks: each row of it becomes one request */
export enum SourceKindE {
  words = 'words',
  meanings = 'meanings',
  translations = 'translations',
}

export type BulkItemT = EnWordListItemT | EnMeaningListItemT | EnMeaningTranslationListItemT;

export type WordsFilterT = Omit<ListWordsQueryT, 'page' | 'limit'>;
export type MeaningsFilterT = Omit<ListMeaningsQueryT, 'page' | 'limit'>;
export type TranslationsFilterT = Omit<ListMeaningTranslationsQueryT, 'page' | 'limit'>;

/** The chosen table together with the filter applied to it */
export type SourceStateT =
  | { kind: SourceKindE.words; filter: WordsFilterT }
  | { kind: SourceKindE.meanings; filter: MeaningsFilterT }
  | { kind: SourceKindE.translations; filter: TranslationsFilterT };

export enum AuthHeaderModeE {
  bearer = 'bearer',
  x_api_key = 'x_api_key',
  custom = 'custom',
}

export enum ResponseMapperIdE {
  json_in_text = 'json_in_text',
  json_body = 'json_body',
  text = 'text',
}

export enum RunStatusE {
  idle = 'idle',
  loading_words = 'loading_words',
  running = 'running',
  cancelled = 'cancelled',
  done = 'done',
}

export enum RunScopeE {
  selected = 'selected',
  filtered = 'filtered',
}

/**
 * Everything the run needs. The API key lives only in this object in component
 * state: it is never persisted, never sent to our own API and never logged.
 */
export type BulkRequestConfigT = {
  url: string;
  apiKey: string;
  authHeaderMode: AuthHeaderModeE;
  customAuthHeaderName: string;
  // one "Header-Name: value" per line
  extraHeaders: string;
  promptTemplate: string;
  // JSON text; placeholders are substituted JSON-escaped so it stays valid JSON
  bodyTemplate: string;
  mapper: ResponseMapperIdE;
  // dotted / bracket path to the part of the response the mapper works on; empty = auto-detect
  responsePath: string;
  concurrency: number;
  maxRetries: number;
};

/** The fields that open every output line and identify the source row */
export type RunIdentityT = { word: string; part_of_speech: string } & Record<string, unknown>;

export type RunResultLineT = RunIdentityT;

export type RunFailureT = {
  identity: RunIdentityT;
  // what the row is, for the failures table: the word, a meaning title, a translation title
  label: string;
  reason: string;
  status?: number | undefined;
  item: BulkItemT;
};

export type RunProgressT = {
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
};
