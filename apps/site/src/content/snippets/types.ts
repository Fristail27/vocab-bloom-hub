import type { HttpMethodT } from '../openapi';

/**
 * One request of the API reference, digested from the OpenAPI document:
 * everything a code snippet needs, in plain values. A snippet is a function
 * of this and nothing else, so adding a language needs no knowledge of the
 * OpenAPI shape or of the site (README.md next to this file).
 */
export type SnippetRequestT = {
  method: HttpMethodT;
  /** The whole URL with the sample path parameters filled in: `https://your-instance.example/api/v1/words/run` */
  url: string;
  /** The path of that URL: `/api/v1/words/run` */
  path: string;
  /** The instance without the API prefix: `https://your-instance.example` — what the SDKs take as base URL */
  origin: string;
  /** The JSON body of a write — the required fields with sample values; null for a request without one */
  body: Record<string, unknown> | null;
  /** The endpoint's anchor on the reference page and its `?endpoint=` in the playground: `get-words-word` */
  slug: string;
};

export type SnippetLanguageT = {
  /** Stable id — the tab's key, remembered as the reader's choice */
  id: string;
  /** The tab's label, as the language calls itself; not translated */
  label: string;
  /** The highlight.js language of the code (`bash`, `javascript`, …); it must be registered in content/highlight.ts */
  highlight: string;
  /** The snippet of a request — or null when this language has none for it, and the tab is not shown there */
  render: (request: SnippetRequestT) => string | null;
};
