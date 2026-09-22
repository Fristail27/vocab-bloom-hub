import nestConfig from './eslint/nest';
import nextConfig from './eslint/next';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/build/**',
      // operator-facing example files (PM2 process file), not project code
      'docs/**/examples/**',
      // the Playwright report and traces of a local e2e run (git-ignored)
      'apps/e2e/playwright-report/**',
      'apps/e2e/test-results/**',
    ],
  },
  ...nextConfig,
  ...nestConfig,
];
