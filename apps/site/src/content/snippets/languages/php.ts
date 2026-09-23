import { phpLiteral } from '../literals';
import type { SnippetLanguageT } from '../types';

/** The curl extension, the way most PHP code speaks HTTP */
export const php: SnippetLanguageT = {
  id: 'php',
  label: 'PHP',
  highlight: 'php',
  render: ({ method, url, body }) => {
    const options = [
      '    CURLOPT_RETURNTRANSFER => true,',
      ...(body
        ? [
            `    CURLOPT_CUSTOMREQUEST => '${method}',`,
            `    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],`,
            `    CURLOPT_POSTFIELDS => json_encode(${phpLiteral(body, 2)}),`,
          ]
        : []),
    ];
    return [
      `$ch = curl_init('${url}');`,
      'curl_setopt_array($ch, [',
      ...options,
      ']);',
      '$answer = json_decode(curl_exec($ch), true);',
      'curl_close($ch);',
    ].join('\n');
  },
};
