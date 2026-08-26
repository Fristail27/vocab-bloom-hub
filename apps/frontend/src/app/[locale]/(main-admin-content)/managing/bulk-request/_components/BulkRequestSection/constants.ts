import { AuthHeaderModeE, BulkRequestConfigT, ResponseMapperIdE, SourceKindE } from './types';

export const RECORDS_PAGE_SIZE = 50;
// page size used while collecting "everything matching the filter" for a run;
// equals LIST_MAX_LIMIT on the server
export const RUN_COLLECT_PAGE_SIZE = 200;
export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 20;
export const MAX_RETRIES = 5;
// how many failures the panel renders; the full list is always downloadable
export const FAILURES_PREVIEW_LIMIT = 100;

export const RESULTS_FILE_NAME = 'vocab-bloom-hub-bulk-request-results.jsonl';
export const FAILURES_FILE_NAME = 'vocab-bloom-hub-bulk-request-failures.jsonl';

// One default prompt per source table; switching the table swaps the prompt
// unless the admin has edited it
export const DEFAULT_PROMPT_TEMPLATES: Record<SourceKindE, string> = {
  [SourceKindE.words]:
    'Give synonyms for the English {{part_of_speech}} "{{word}}" in the form {"synonyms": ["...", "..."]}. ' +
    'If the word is a proper noun or an abbreviation, answer {"synonyms": []}.',
  [SourceKindE.meanings]:
    'Give synonyms and antonyms for the English {{part_of_speech}} "{{word}}" only in the meaning "{{title}}" ({{definition}}): ' +
    'single words of the same part of speech in their base form — synonyms that can replace it in this meaning, ' +
    'antonyms that mean the opposite in this meaning — excluding "{{word}}" itself and its inflected forms, ' +
    'in the form {"synonyms": ["...", "..."], "antonyms": ["...", "..."]}. ' +
    'Use an empty list for a side this meaning does not have, e.g. {"synonyms": [], "antonyms": []}.',
  [SourceKindE.translations]:
    'Check the translation into "{{language}}" of the English {{part_of_speech}} "{{word}}" in the meaning ' +
    '"{{meaning_title}}" ({{meaning_definition}}): title "{{title}}", definition "{{definition}}". ' +
    'Answer in the form {"is_correct": true, "title": "...", "definition": "...", "comment": "..."}, ' +
    'repeating the current title and definition when they are correct and giving better ones otherwise.',
};

// Chat-completions body: a fixed system message sets the JSON-only contract,
// the rendered prompt for one row goes in as the user message; placeholders
// are injected JSON-escaped
export const DEFAULT_BODY_TEMPLATE = `{
  "model": "deepseek-v4-flash",
  "messages": [
    {
      "role": "system",
      "content": "You are a language API service. You always answer with a single JSON object and nothing else: no prose, no markdown, no code fences. If you believe there is no correct answer, answer with a JSON object of the form {\\"error\\": \\"<short reason>\\"} instead of guessing."
    },
    { "role": "user", "content": "{{prompt}}" }
  ],
  "stream": false,
  "think": false
}`;

export const DEFAULT_SOURCE_KIND = SourceKindE.words;

export const DEFAULT_CONFIG: BulkRequestConfigT = {
  url: 'https://api.deepseek.com/chat/completions',
  apiKey: '',
  authHeaderMode: AuthHeaderModeE.bearer,
  customAuthHeaderName: '',
  extraHeaders: '',
  promptTemplate: DEFAULT_PROMPT_TEMPLATES[DEFAULT_SOURCE_KIND],
  bodyTemplate: DEFAULT_BODY_TEMPLATE,
  mapper: ResponseMapperIdE.json_in_text,
  responsePath: 'choices[0].message.content',
  concurrency: 2,
  maxRetries: 3,
};
