import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  env: {
    PORT: process.env.FRONT_PORT || '3000',
  },
  // A self-contained build for the Docker image (issue #316): .next/standalone
  // holds server.js and only the node_modules the app needs. The tracing root
  // is the monorepo root so the hoisted node_modules are found; the output then
  // lives under .next/standalone/apps/frontend
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default withNextIntl(nextConfig);
