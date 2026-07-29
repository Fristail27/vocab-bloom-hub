import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  env: {
    PORT: process.env.FRONT_PORT || '3000',
  },
};

export default withNextIntl(nextConfig);
