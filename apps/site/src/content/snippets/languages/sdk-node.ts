import type { SnippetLanguageT, SnippetRequestT } from '../types';

/**
 * The typed Node.js / browser client, `@vocab-bloom-hub/client`: one method
 * per endpoint, written by hand here because the method names are not in the
 * OpenAPI document. An endpoint without an entry shows no tab for this
 * language — add its snippet below, keyed by the endpoint's slug (the anchor
 * on the reference page: `get-words-word`, `post-words-batch`, …)
 */
const BY_SLUG: Record<string, (request: SnippetRequestT) => string> = {
  'get-meta': ({ origin }) =>
    [
      `import { VocabBloomClient } from '@vocab-bloom-hub/client';`,
      '',
      `const client = new VocabBloomClient({ baseUrl: '${origin}' });`,
      'const { data } = await client.meta();',
      'console.log(data.available_languages, data.counts.entries);',
    ].join('\n'),
};

export const sdkNode: SnippetLanguageT = {
  id: 'sdk-node',
  label: 'Node.js SDK',
  highlight: 'typescript',
  render: (request) => BY_SLUG[request.slug]?.(request) ?? null,
};
