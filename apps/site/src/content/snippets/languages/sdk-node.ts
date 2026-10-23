import { jsLiteral } from '../literals';
import { pathArguments } from '../request';
import type { SnippetLanguageT, SnippetRequestT } from '../types';

/**
 * The typed Node.js / browser client, `@vocab-bloom-hub/client`: one method
 * per endpoint, written by hand here because the method names are not in the
 * OpenAPI document. An endpoint without an entry shows no tab for this
 * language — add its snippet below, keyed by the endpoint's slug (the anchor
 * on the reference page: `get-words-word`, `post-words-batch`, …)
 */
const client = (origin: string): string[] => [
  `import { VocabBloomClient } from '@vocab-bloom-hub/client';`,
  '',
  `const client = new VocabBloomClient({ baseUrl: '${origin}' });`,
];

const BY_SLUG: Record<string, (request: SnippetRequestT) => string> = {
  'get-words-word-antonyms': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/antonyms');
    return [
      ...client(request.origin),
      `const { data } = await client.antonyms(${jsLiteral(word)});`,
      'console.log(data.map((link) => link.word));',
    ].join('\n');
  },
  'get-words-word-synonyms': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/synonyms');
    return [
      ...client(request.origin),
      `const { data } = await client.synonyms(${jsLiteral(word)});`,
      'console.log(data.map((link) => link.word));',
    ].join('\n');
  },
  'get-words-word-translations': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/translations');
    return [
      ...client(request.origin),
      `const { data } = await client.translations(${jsLiteral(word)});`,
      'const first = data.meaning_translations[0];',
      'console.log(first?.title, first?.language);',
    ].join('\n');
  },
  'get-openapi-json': ({ origin }) =>
    [
      ...client(origin),
      'const document = await client.openapi();',
      'const info = document.info;',
      "if (info && typeof info === 'object' && 'version' in info) {",
      '  console.log(info.version);',
      '}',
    ].join('\n'),
  'get-words-word-forms': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/forms');
    return [
      ...client(request.origin),
      `const { data } = await client.forms(${jsLiteral(word)});`,
      'for (const form of data) {',
      '  console.log(form.word, form.form_of_word);',
      '}',
    ].join('\n');
  },
  'get-random': ({ origin }) =>
    [...client(origin), 'const { data } = await client.random();', 'console.log(data.word);'].join('\n'),
  'post-words-batch': ({ origin, body }) =>
    [
      ...client(origin),
      `const { data, meta } = await client.wordsBatch(${jsLiteral(body?.words)});`,
      'console.log(data.map((item) => item.word), meta.not_found);',
    ].join('\n'),
  'get-words-id-id': (request) => {
    const [id] = pathArguments(request, '/api/v1/words/id/{id}');
    return [
      ...client(request.origin),
      `const { data } = await client.wordById(${Number(id)});`,
      'console.log(data.word, data.part_of_speech);',
    ].join('\n');
  },
  'get-words-word': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}');
    return [
      ...client(request.origin),
      `const { data } = await client.word(${jsLiteral(word)});`,
      'console.log(data[0]?.meanings?.[0]?.definition);',
    ].join('\n');
  },
  'get-words-word-meanings': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/meanings');
    return [
      ...client(request.origin),
      `const { data } = await client.meanings(${jsLiteral(word)});`,
      'console.log(data[0]?.definition);',
    ].join('\n');
  },
  'get-datasets': ({ origin }) =>
    [
      ...client(origin),
      'const { data } = await client.datasets();',
      'console.log(data.map(dataset => dataset.dataset));',
    ].join('\n'),
  'get-search-datasets': ({ origin }) =>
    [
      ...client(origin),
      "const { data } = await client.searchDatasets({ search: 'run', datasets: ['default'] });",
      'for (const group of data) {',
      "  if (group.status === 'ok') console.log(group.dataset, group.data, group.meta.has_more);",
      '  else console.log(group.dataset, group.error);',
      '}',
    ].join('\n'),
  'get-search-semantic': ({ origin }) =>
    [
      ...client(origin),
      "const { data } = await client.searchSemantic({ query: 'A scientist who studies birds' });",
      'console.log(data[0]?.word.word, data[0]?.meaning.definition);',
    ].join('\n'),
  'get-search-semantic-status': ({ origin }) =>
    [...client(origin), 'const { data } = await client.semanticStatus();', 'console.log(data.enabled);'].join(
      '\n',
    ),
  'get-search-detailed': ({ origin }) =>
    [
      ...client(origin),
      "const { data } = await client.searchDetailed({ search: 'run', with_meanings: true });",
      'const first = data[0];',
      'console.log(first?.part_of_speech, first?.meanings?.[0]?.title);',
    ].join('\n'),
  'get-search': ({ origin }) =>
    [
      ...client(origin),
      "const { data, meta } = await client.search({ search: 'run' });",
      'console.log(meta.fuzzy, data[0]?.word);',
    ].join('\n'),
  'post-suggestions': ({ origin, body }) =>
    [
      ...client(origin),
      `const { data } = await client.suggest(${jsLiteral(body)});`,
      'console.log(data.id, data.status);',
    ].join('\n'),
  'get-words': ({ origin }) =>
    [
      ...client(origin),
      "const { data } = await client.words({ word_level: ['A1'] });",
      'console.log(data.slice(0, 5).map((entry) => entry.word));',
      '',
      '// To read every matching entry across all pages:',
      "// for await (const entry of client.iterateWords({ word_level: ['A1'] })) {",
      '//   console.log(entry.word);',
      '// }',
    ].join('\n'),
  'get-meta': ({ origin }) =>
    [
      ...client(origin),
      'const { data } = await client.meta();',
      'console.log(data.available_languages, data.counts.entries);',
    ].join('\n'),
  // a group per dataset of the instance, each under its own terms (issue #528)
  'get-words-word-datasets': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/datasets');

    return [
      ...client(request.origin),
      `const { data, meta } = await client.wordDatasets(${jsLiteral(word)});`,
      'console.log(`${meta.found} of ${meta.datasets} datasets hold the word`);',
      'for (const group of data) {',
      '  // the entries of a group are used under the terms of that group',
      '  console.log(group.dataset, group.license, group.attribution, group.entries.length);',
      '}',
    ].join('\n');
  },
  'get-words-word-datasets-dataset-history': (request) => {
    const [word, dataset] = pathArguments(request, '/api/v1/words/{word}/datasets/{dataset}/history');

    return [
      ...client(request.origin),
      `const { data } = await client.datasetHistory(${jsLiteral(word)}, ${jsLiteral(dataset)});`,
      'for (const change of data) {',
      '  console.log(change.created_at, change.entity, change.action, change.diff);',
      '}',
    ].join('\n');
  },
};

export const sdkNode: SnippetLanguageT = {
  id: 'sdk-node',
  label: 'Node.js SDK',
  highlight: 'typescript',
  render: (request) => BY_SLUG[request.slug]?.(request) ?? null,
};
