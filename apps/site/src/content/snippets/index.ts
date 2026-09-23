// The code snippets of the API reference: one tab per language
// under every endpoint, generated from the OpenAPI document. A language is
// a small module under languages/ — README.md says how to add one

import { curl } from './languages/curl';
import { go } from './languages/go';
import { javascript } from './languages/javascript';
import { php } from './languages/php';
import { python } from './languages/python';
import { sdkNode } from './languages/sdk-node';
import { sdkPython } from './languages/sdk-python';
import type { SnippetLanguageT, SnippetRequestT } from './types';

export { buildSnippetRequest } from './request';
export type { SnippetLanguageT, SnippetRequestT } from './types';

/** Every language, in the order of the tabs; the first one is what a reader sees before choosing */
export const SNIPPET_LANGUAGES: readonly SnippetLanguageT[] = [
  curl,
  javascript,
  python,
  go,
  php,
  sdkNode,
  sdkPython,
];

export type SnippetT = { id: string; label: string; highlight: string; code: string };

/** The snippets a request has, one per language that renders it */
export const snippetsOf = (
  request: SnippetRequestT,
  languages: readonly SnippetLanguageT[] = SNIPPET_LANGUAGES,
): SnippetT[] =>
  languages.flatMap(({ id, label, highlight, render }) => {
    const code = render(request);
    return code === null ? [] : [{ id, label, highlight, code }];
  });
