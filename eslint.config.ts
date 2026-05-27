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
    ],
  },
  ...nextConfig,
  ...nestConfig,
];
