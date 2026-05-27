import base from './base';

export default [
  ...base,

  {
    files: ['apps/server/**/*.ts'],

    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
