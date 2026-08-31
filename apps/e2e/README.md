# Browser e2e tests

Playwright tests that exercise the full stack: a real Chromium drives the admin UI (and, in a
suite of its own, the project website) served by production Next.js builds, which talk to a real
NestJS API backed by an isolated SQLite database (`.tmp/e2e.sqlite` / `.tmp/site-e2e.sqlite`,
wiped on every run). The developer's `dev.sqlite` and Postgres are never touched.

## Running

```bash
yarn e2e        # from the repo root: builds the frontend, boots both apps, runs the tests
yarn e2e:ui     # the same with the Playwright UI
yarn workspace e2e test             # rerun without rebuilding the frontend
yarn workspace e2e test --headed    # watch the browser

yarn e2e:site   # the website suite (issue #330): builds apps/site, boots the API + the site
yarn e2e:site:ui                    # the same with the Playwright UI
yarn workspace e2e test:site        # rerun without rebuilding the site
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
- The UI-driven CRUD specs drive changes through the real forms and modals and verify
  persistence through the API against the isolated database; only prerequisite data is seeded
  via the API. `tests/word-crud.spec.ts` covers the create flows (add-word wizard, word-card
  modals), `tests/word-edit-delete.spec.ts` the edit/delete modals of every card entity,
  `tests/add-word-wizard.spec.ts` the wizard branches (forms + meanings + translations,
  already-exists, phrase and grammar-pattern entry types), and `tests/phrasal-verbs.spec.ts`
  the phrasal-base linking in the wizard and in the card.
- The database file is deleted by the server `webServer` command right before boot — not in
  `globalSetup`, which runs only after the servers are already up (deleting the file under a live
  server turns every write into `SQLITE_READONLY_DBMOVED`).
- This workspace intentionally has its own `tsconfig.json`: jest (`@types/jest`) and
  `@playwright/test` both declare `test`/`expect` globals and must not share a TS project.

## The website suite (`tests-site/`, issue #330)

`playwright.site.config.ts` is a config of its own so the two suites never share servers: the
API on port 3012 (`.tmp/site-e2e.sqlite`, public rate limit lifted for the crawler) and the
production build of `apps/site` on port 3021 with `API_INTERNAL_URL` pointing at it — the same
wiring docker compose uses, so the browser calls the relative `/api` and the site forwards it.
The `seed` project (`tests-site/site.setup.ts`) posts the fixture words
(`helpers/site-fixture.ts`, mirroring `apps/server/test/harness/public-api-fixture.ts`) through
the admin API with a derived Bearer token — the site has no login UI to reuse. The specs cover
the landing in both locales and the language switch, a docs page (sidebar, table of contents,
highlighted code), the API reference anchors, the playground round-trip against the live API,
the server-rendered word pages (`/word/random` redirect and the 404 included) and a crawler
that follows every `/en/docs` link asserting each internal href answers 200 and each `#anchor`
exists on its target page.
