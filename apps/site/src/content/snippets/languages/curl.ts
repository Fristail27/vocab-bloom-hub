import { jsonLine } from '../literals';
import type { SnippetLanguageT } from '../types';

/** A copy-and-run curl line: the first tab, what every reader knows */
export const curl: SnippetLanguageT = {
  id: 'curl',
  label: 'curl',
  highlight: 'bash',
  render: ({ method, url, body }) => {
    if (!body) return `curl '${url}'`;
    return [
      `curl -X ${method} '${url}'`,
      `  -H 'Content-Type: application/json'`,
      `  -d '${jsonLine(body)}'`,
    ].join(' \\\n');
  },
};
