import { encodeWordCursor } from '../modules/PublicApiModule/utils/cursor';

export type ScenarioT = {
  name: string;
  group: 'search' | 'word' | 'list' | 'random' | 'meta' | 'admin';
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  admin?: boolean;
};

export type ScenarioContextT = {
  // the id of the verb "run": the most-loaded entry of the dataset (four
  // meanings, four forms, phrasal variants), the worst case of a detail read
  runVerbId: number;
};

/**
 * The hot reads of the API on the full dictionary (issue #279): every
 * search tier, the headword and id lookups, the filtered list at
 * different selectivities, the random draw, the meta endpoint and the
 * admin listings. Paths are relative to the server root.
 */
export const buildScenarios = ({ runVerbId }: ScenarioContextT): ScenarioT[] => [
  // ---- search (POST /api/v1/search): every tier runs on each call, the
  // term decides how many rows each LIKE touches
  {
    name: 'search exact "run" (+ phrasal, prefix tiers)',
    group: 'search',
    method: 'POST',
    path: '/api/v1/search',
    body: { search: 'run' },
  },
  {
    name: 'search broad prefix "ab"',
    group: 'search',
    method: 'POST',
    path: '/api/v1/search',
    body: { search: 'ab' },
  },
  {
    name: 'search rare "xylo"',
    group: 'search',
    method: 'POST',
    path: '/api/v1/search',
    body: { search: 'xylo' },
  },
  {
    name: 'search phrase "put up"',
    group: 'search',
    method: 'POST',
    path: '/api/v1/search',
    body: { search: 'put up' },
  },
  {
    name: 'search typo "recieve" (fuzzy tier)',
    group: 'search',
    method: 'POST',
    path: '/api/v1/search',
    body: { search: 'recieve' },
  },
  {
    name: 'search no match "qzxvj" (fuzzy tier, empty)',
    group: 'search',
    method: 'POST',
    path: '/api/v1/search',
    body: { search: 'qzxvj' },
  },
  {
    name: 'search detailed "run" + meanings + translations',
    group: 'search',
    method: 'POST',
    path: '/api/v1/search/detailed',
    body: { search: 'run', with_meanings: true, with_translations: true },
  },
  // ---- headword / id lookups
  { name: 'word "run" (noun + verb, full)', group: 'word', method: 'GET', path: '/api/v1/words/run' },
  { name: 'word "ran" (form → base entry)', group: 'word', method: 'GET', path: '/api/v1/words/ran' },
  { name: 'word by id (run, verb)', group: 'word', method: 'GET', path: `/api/v1/words/id/${runVerbId}` },
  { name: 'word "run" translations', group: 'word', method: 'GET', path: '/api/v1/words/run/translations' },
  // ---- filtered list: unselective, selective, array column, deep cursor, joins
  { name: 'list first page (no filter)', group: 'list', method: 'GET', path: '/api/v1/words' },
  { name: 'list word_level=B1', group: 'list', method: 'GET', path: '/api/v1/words?word_level=B1' },
  {
    name: 'list noun + C2',
    group: 'list',
    method: 'GET',
    path: '/api/v1/words?part_of_speech=noun&word_level=C2',
  },
  { name: 'list category=IT (rare)', group: 'list', method: 'GET', path: '/api/v1/words?category=IT' },
  {
    name: 'list language_register=slang',
    group: 'list',
    method: 'GET',
    path: '/api/v1/words?language_register=slang',
  },
  {
    name: 'list form_of_word=past_simple',
    group: 'list',
    method: 'GET',
    path: '/api/v1/words?form_of_word=past_simple',
  },
  {
    name: 'list cursor at "m" (deep page)',
    group: 'list',
    method: 'GET',
    path: `/api/v1/words?cursor=${encodeURIComponent(encodeWordCursor({ word: 'm', id: 1 }))}`,
  },
  {
    name: 'list cursor at "m" + word_level=C1',
    group: 'list',
    method: 'GET',
    path: `/api/v1/words?word_level=C1&cursor=${encodeURIComponent(encodeWordCursor({ word: 'm', id: 1 }))}`,
  },
  {
    name: 'list 50 + meanings + translations',
    group: 'list',
    method: 'GET',
    path: '/api/v1/words?limit=50&with_meanings=true&with_translations=true',
  },
  // ---- random
  { name: 'random (no filter)', group: 'random', method: 'GET', path: '/api/v1/random' },
  {
    name: 'random A1 noun',
    group: 'random',
    method: 'GET',
    path: '/api/v1/random?word_level=A1&part_of_speech=noun',
  },
  { name: 'random category=medical', group: 'random', method: 'GET', path: '/api/v1/random?category=medical' },
  // ---- meta (counts cached for a minute)
  { name: 'meta', group: 'meta', method: 'GET', path: '/api/v1/meta' },
  // ---- admin listings (offset paging + total count) and the detail read
  {
    name: 'admin words word_level=B1 (page 1 + total)',
    group: 'admin',
    method: 'GET',
    path: '/api/en/words?word_level=B1',
    admin: true,
  },
  {
    name: 'admin words search=un (prefix)',
    group: 'admin',
    method: 'GET',
    path: '/api/en/words?search=un',
    admin: true,
  },
  {
    name: 'admin meanings part_of_speech=verb',
    group: 'admin',
    method: 'GET',
    path: '/api/en/meanings?part_of_speech=verb',
    admin: true,
  },
  { name: 'admin word by id', group: 'admin', method: 'GET', path: `/api/en/${runVerbId}`, admin: true },
  { name: 'admin statistics', group: 'admin', method: 'GET', path: '/api/en/statistics', admin: true },
];
