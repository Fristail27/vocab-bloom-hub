import type { SnippetLanguageT, SnippetRequestT } from '../types';

/**
 * The typed Python client, `vocab-bloom-hub` on PyPI: one method per
 * endpoint, written by hand here because the method names are not in the
 * OpenAPI document. An endpoint without an entry shows no tab for this
 * language — add its snippet below, keyed by the endpoint's slug (the anchor
 * on the reference page: `get-words-word`, `post-words-batch`, …)
 */
const BY_SLUG: Record<string, (request: SnippetRequestT) => string> = {
  'get-meta': ({ origin }) =>
    [
      'from vocab_bloom_hub import VocabBloomClient',
      '',
      `client = VocabBloomClient("${origin}")`,
      'meta = client.meta()',
      'print(meta.data.available_languages, meta.data.counts.entries)',
    ].join('\n'),
};

export const sdkPython: SnippetLanguageT = {
  id: 'sdk-python',
  label: 'Python SDK',
  highlight: 'python',
  render: (request) => BY_SLUG[request.slug]?.(request) ?? null,
};
