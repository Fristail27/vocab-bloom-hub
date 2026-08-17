# Browser e2e tests

Playwright tests that exercise the full stack: a real Chromium drives the admin UI served by a
production Next.js build, which talks to a real NestJS API backed by an isolated SQLite database
(`.tmp/e2e.sqlite`, wiped on every run). The developer's `dev.sqlite` and Postgres are never
touched.

## Running

```bash
yarn e2e        # from the repo root: builds the frontend, boots both apps, runs the tests
yarn e2e:ui     # the same with the Playwright UI
yarn workspace e2e test             # rerun without rebuilding the frontend
yarn workspace e2e test --headed    # watch the browser
```

First run on a new machine: `yarn workspace e2e exec playwright install chromium`.

## How it works

- `playwright.config.ts` boots two `webServer` processes: the NestJS API on port 3011 with
  `DATABASE_URL=sqlite:.tmp/e2e.sqlite` and dedicated admin credentials, and `next start` on port
  3001 serving the build produced by `yarn e2e:build` (which bakes the e2e API URL into the
  bundle).
- The `setup` project (`tests/auth.setup.ts`) logs in once through the real login form; the saved
  `storageState` (httpOnly bearer cookie) authenticates every other test.
- Tests seed data through the real admin API (`helpers/seed.ts`) and assert through the UI and
  the API.
- The database file is deleted by the server `webServer` command right before boot — not in
  `globalSetup`, which runs only after the servers are already up (deleting the file under a live
  server turns every write into `SQLITE_READONLY_DBMOVED`).
- This workspace intentionally has its own `tsconfig.json`: jest (`@types/jest`) and
  `@playwright/test` both declare `test`/`expect` globals and must not share a TS project.
