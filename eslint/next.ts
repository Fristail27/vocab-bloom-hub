import nextPlugin from '@next/eslint-plugin-next';

import base from './base';

export default [
  ...base,
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-img-element': 'warn',
    },
  },
];
