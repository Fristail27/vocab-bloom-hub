import { defineConfig } from '@playwright/test';

import config from './playwright.site.config';

const servers = Array.isArray(config.webServer) ? config.webServer : [];
if (!process.env.SITE_E2E_POSTGRES_URL) throw new Error('Set SITE_E2E_POSTGRES_URL');

export default defineConfig({
  ...config,
  webServer: [
    {
      ...servers[0],
      command: 'node helpers/site-postgres.mjs',
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
    },
    ...servers.slice(1),
  ],
});
