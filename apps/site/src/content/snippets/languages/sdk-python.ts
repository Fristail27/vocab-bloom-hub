import { pythonLiteral } from '../literals';
import { pathArguments } from '../request';
import type { SnippetLanguageT, SnippetRequestT } from '../types';

/**
 * The typed Python client, `vocab-bloom-hub` on PyPI: one method per
 * endpoint, written by hand here because the method names are not in the
 * OpenAPI document. An endpoint without an entry shows no tab for this
 * language — add its snippet below, keyed by the endpoint's slug (the anchor
 * on the reference page: `get-words-word`, `post-words-batch`, …)
 */
const client = (origin: string): string[] => [
  'from vocab_bloom_hub import VocabBloomClient',
  '',
  `client = VocabBloomClient("${origin}")`,
];

const BY_SLUG: Record<string, (request: SnippetRequestT) => string> = {
  'get-words-word-antonyms': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/antonyms');
    return [
      ...client(request.origin),
      `answer = client.antonyms(${pythonLiteral(word)})`,
      'print([link.word for link in answer.data])',
    ].join('\n');
  },
  'get-words-word-synonyms': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/synonyms');
    return [
      ...client(request.origin),
      `answer = client.synonyms(${pythonLiteral(word)})`,
      'print([link.word for link in answer.data])',
    ].join('\n');
  },
  'get-words-word-translations': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/translations');
    return [
      ...client(request.origin),
      `answer = client.translations(${pythonLiteral(word)})`,
      'first = answer.data.meaning_translations[0] if answer.data.meaning_translations else None',
      'print(first.title if first else None, first.language.value if first else None)',
    ].join('\n');
  },
  'get-openapi-json': ({ origin }) =>
    [...client(origin), 'document = client.openapi()', 'print(document["info"]["version"])'].join('\n'),
  'get-words-word-forms': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/forms');
    return [
      ...client(request.origin),
      `answer = client.forms(${pythonLiteral(word)})`,
      'for form in answer.data:',
      '    print(form.word, form.form_of_word.value)',
    ].join('\n');
  },
  'get-random': ({ origin }) =>
    [...client(origin), 'answer = client.random()', 'print(answer.data.word)'].join('\n'),
  'post-words-batch': ({ origin, body }) =>
    [
      ...client(origin),
      `answer = client.words_batch(${pythonLiteral(body?.words)})`,
      'print([item.word for item in answer.data], answer.meta.not_found)',
    ].join('\n'),
  'get-words-id-id': (request) => {
    const [id] = pathArguments(request, '/api/v1/words/id/{id}');
    return [
      ...client(request.origin),
      `answer = client.word_by_id(${Number(id)})`,
      'print(answer.data.word, answer.data.part_of_speech.value)',
    ].join('\n');
  },
  'get-words-word': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}');
    return [
      ...client(request.origin),
      `answer = client.word(${pythonLiteral(word)})`,
      'first = answer.data[0] if answer.data else None',
      'print(first.meanings[0].definition if first and first.meanings else None)',
    ].join('\n');
  },
  'get-words-word-meanings': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/meanings');
    return [
      ...client(request.origin),
      `answer = client.meanings(${pythonLiteral(word)})`,
      'print(answer.data[0].definition if answer.data else None)',
    ].join('\n');
  },
  'get-datasets': ({ origin }) =>
    [
      ...client(origin),
      'answer = client.datasets()',
      'print([dataset.dataset for dataset in answer.data])',
    ].join('\n'),
  'get-search-datasets': ({ origin }) =>
    [
      ...client(origin),
      'from vocab_bloom_hub import SearchDatasetResult',
      'answer = client.search_datasets("run", ["default"])',
      'for group in answer.data:',
      '    if isinstance(group, SearchDatasetResult):',
      '        print(group.dataset, group.data, group.meta.has_more)',
      '    else:',
      '        print(group.dataset, group.error)',
    ].join('\n'),
  'get-search-detailed': ({ origin }) =>
    [
      ...client(origin),
      'answer = client.search_detailed("run", with_meanings=True)',
      'first = answer.data[0] if answer.data else None',
      'print(',
      '    first.part_of_speech.value if first else None,',
      '    first.meanings[0].title if first and first.meanings else None,',
      ')',
    ].join('\n'),
  'get-search': ({ origin }) =>
    [
      ...client(origin),
      'answer = client.search("run")',
      'print(answer.meta.fuzzy, answer.data[0].word if answer.data else None)',
    ].join('\n'),
  'post-suggestions': ({ origin, body }) =>
    [
      ...client(origin),
      `answer = client.suggest(**${pythonLiteral(body)})`,
      'print(answer.data.id, answer.data.status)',
    ].join('\n'),
  'get-words': ({ origin }) =>
    [
      ...client(origin),
      'answer = client.words(word_level=["A1"])',
      'print([entry.word for entry in answer.data[:5]])',
      '',
      '# To read every matching entry across all pages:',
      '# for entry in client.iter_words(word_level=["A1"]):',
      '#     print(entry.word)',
    ].join('\n'),
  'get-meta': ({ origin }) =>
    [
      ...client(origin),
      'meta = client.meta()',
      'print(meta.data.available_languages, meta.data.counts.entries)',
    ].join('\n'),
  // a group per dataset of the instance, each under its own terms (issue #528)
  'get-words-word-datasets': (request) => {
    const [word] = pathArguments(request, '/api/v1/words/{word}/datasets');

    return [
      ...client(request.origin),
      `answer = client.word_datasets(${pythonLiteral(word)})`,
      'print(f"{answer.meta.found} of {answer.meta.datasets} datasets hold the word")',
      'for group in answer.data:',
      '    # the entries of a group are used under the terms of that group',
      '    print(group.dataset, group.license, group.attribution, len(group.entries))',
    ].join('\n');
  },
  'get-words-word-datasets-dataset-history': (request) => {
    const [word, dataset] = pathArguments(request, '/api/v1/words/{word}/datasets/{dataset}/history');

    return [
      ...client(request.origin),
      `history = client.dataset_history(${pythonLiteral(word)}, ${pythonLiteral(dataset)})`,
      'for change in history.data:',
      '    print(change.created_at, change.entity.value, change.action.value, change.diff)',
    ].join('\n');
  },
};

export const sdkPython: SnippetLanguageT = {
  id: 'sdk-python',
  label: 'Python SDK',
  highlight: 'python',
  render: (request) => BY_SLUG[request.slug]?.(request) ?? null,
};
