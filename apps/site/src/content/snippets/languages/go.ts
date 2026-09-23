import { jsonLine } from '../literals';
import type { SnippetLanguageT } from '../types';

/** The standard library only: net/http and encoding/json */
export const go: SnippetLanguageT = {
  id: 'go',
  label: 'Go',
  highlight: 'go',
  render: ({ method, url, body }) => {
    const call =
      method === 'GET'
        ? `resp, err := http.Get("${url}")`
        : method === 'POST' && body
          ? `resp, err := http.Post("${url}", "application/json", strings.NewReader(\`${jsonLine(body)}\`))`
          : null;
    // the other verbs need a Request; none of the public endpoints uses them
    if (!call) return null;
    const imports = ['"encoding/json"', '"log"', '"net/http"', ...(body ? ['"strings"'] : [])];
    return [
      'import (',
      ...imports.map((name) => `\t${name}`),
      ')',
      '',
      call,
      'if err != nil {',
      '\tlog.Fatal(err)',
      '}',
      'defer resp.Body.Close()',
      '',
      'var answer map[string]any',
      'if err := json.NewDecoder(resp.Body).Decode(&answer); err != nil {',
      '\tlog.Fatal(err)',
      '}',
    ].join('\n');
  },
};
