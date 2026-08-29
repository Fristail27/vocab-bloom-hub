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
    ],
  },
  ...nextConfig,
  ...nestConfig,
];
