import { defineConfig, devices } from '@playwright/test';

import {
  API_URL,
  APP_URL,
  DB_PATH,
  E2E_PASSWORD,
  E2E_USERNAME,
  FRONT_PORT,
  SERVER_PORT,
  STORAGE_STATE,
} from './config';

export default defineConfig({
  testDir: './tests',
  // All tests share one isolated database, so they run strictly one at a time
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    // Logs in through the UI once and saves the session for every other project
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      // The database is wiped HERE, before the server boots: a globalSetup
      // hook runs only after the webServer processes have started, and
      // deleting the sqlite file under a live server turns every write into
      // SQLITE_READONLY_DBMOVED. nest start compiles before serving; the
      // health URL is the Swagger UI, which is enabled outside production.
      // The explicit sqlite: DATABASE_URL wins over the root .env because
      // dotenv never overrides existing vars.
      command: 'mkdir -p .tmp && rm -f .tmp/e2e.sqlite && yarn workspace server start',
      url: API_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      env: {
        DATABASE_URL: `sqlite:${DB_PATH}`,
        SERVER_PORT: String(SERVER_PORT),
        FRONT_PORT: String(FRONT_PORT),
        ADMIN_USERNAME: E2E_USERNAME,
        ADMIN_PASSWORD: E2E_PASSWORD,
        LOG_LEVEL: 'warn',
        // a developer's .env may turn the first-start import on; the browser
        // tests seed their own data and must never reach for HuggingFace
        DICTIONARY_AUTO_IMPORT: 'false',
      },
    },
    {
      // Serves the build produced by `yarn e2e:build` (repo root), which bakes
      // NEXT_PUBLIC_BASE_API_URL for the e2e API into the client bundle; the
      // env var here covers the server-side (SSR) requests of the same build
      // Bypasses the workspace `start` script: its dotenv wrapper is not
      // needed (every variable is passed explicitly right here) and must not
      // leak the developer's .env into the e2e frontend
      command: 'yarn workspace frontend exec next start',
      url: APP_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(FRONT_PORT),
        NEXT_PUBLIC_BASE_API_URL: API_URL,
        // The root .env carries NODE_ENV=development, which must not leak into
        // `next start` serving a production build (React SSR would mismatch)
        NODE_ENV: 'production',
      },
    },
  ],
});
