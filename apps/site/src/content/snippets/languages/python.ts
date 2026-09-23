import { pythonLiteral } from '../literals';
import type { SnippetLanguageT } from '../types';

/** `requests`, the usual HTTP client; the typed client is a tab of its own (sdk-python.ts) */
export const python: SnippetLanguageT = {
  id: 'python',
  label: 'Python',
  highlight: 'python',
  render: ({ method, url, body }) => {
    const call = body
      ? `res = requests.${method.toLowerCase()}("${url}", json=${pythonLiteral(body)})`
      : `res = requests.${method.toLowerCase()}("${url}")`;
    return ['import requests', '', call, 'res.raise_for_status()', 'answer = res.json()'].join('\n');
  },
};
