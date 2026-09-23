import { jsLiteral } from '../literals';
import type { SnippetLanguageT } from '../types';

/** `fetch`, as in a browser or Node.js ≥ 18; the typed client is a tab of its own (sdk-node.ts) */
export const javascript: SnippetLanguageT = {
  id: 'javascript',
  label: 'JavaScript',
  highlight: 'javascript',
  render: ({ method, url, body }) => {
    const request = body
      ? [
          `const res = await fetch('${url}', {`,
          `  method: '${method}',`,
          `  headers: { 'Content-Type': 'application/json' },`,
          `  body: JSON.stringify(${jsLiteral(body, 1)}),`,
          `});`,
        ]
      : [`const res = await fetch('${url}');`];
    return [
      ...request,
      `if (!res.ok) throw new Error(\`HTTP \${res.status}\`);`,
      `const answer = await res.json();`,
    ].join('\n');
  },
};
