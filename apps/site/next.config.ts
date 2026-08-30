import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // A self-contained build for the Docker image, like the admin UI (issue
  // #316): .next/standalone holds server.js and the node_modules it needs,
  // traced from the monorepo root
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default withNextIntl(nextConfig);
