# Admin Storybook

Run from the repository root:

```sh
yarn storybook                  # http://localhost:6006
yarn storybook:build            # apps/frontend/storybook-static
yarn storybook:typecheck
yarn workspace frontend exec playwright install chromium  # once
yarn storybook:test             # Chromium, no running Storybook/server/database needed
```

The workshop renders the **production components**, including their API clients,
styles, Ant Design providers and all eight message catalogs. Choose a language
and light/dark theme in the toolbar; use the viewport control for narrow screens.
It does not load the root `.env`. The API URL is fixed to `/__storybook/api`,
MSW intercepts it, and unhandled API traffic is blocked. The worker is served
only by Storybook, never by the production admin app.

## Where to start

- **Datasets / Management / Playground**: freely create, fork, edit terms and
  versions, open/close, activate and delete the fixture datasets. The other
  management stories demonstrate confirmations, validation, SQLite restrictions,
  installation, source updates and failures.
- **Datasets / Merge and conflict resolution / Unresolved Description**: an open
  conflict ready for manual exploration. The other stories exercise choosing
  either side, editing a custom result, saving, discarding, deleting upstream,
  replacing an entire article, retries, filters, pagination and applying a plan.
- **Datasets / Preparing and applying updates**: parent updates, merges from
  another dataset, manual comparison without a common baseline, background
  progress, reopening a running operation and failures.

Stories with a `play` function perform their demonstration automatically and
check the result. Inspect **Interactions** to see each assertion, or replay the
story to reset it. Saved decisions are kept by the mock while the story is open;
switching stories or replaying starts with fresh data. Running progress stories
deliberately stay at one stage so the UI can be inspected.

## Adding a scenario

Keep fixtures under `stories/mocks/`. `datasetScenario` parameters choose the
API responses; `createDatasetScenario()` creates new state before every story.
Use the shared server response types and keep fixture graphs and counts
consistent. Use `messagesFor(globals)` in interactions so they also work when
the toolbar language changes. Ant Design modals and confirmations render in
`canvasElement.ownerDocument.body`, outside the story canvas.

Use `visibleDialog` from `interactions.ts` for every modal, including nested ones.
Wait for asynchronously rendered content with `waitFor(() => expect(getBy…).toBeVisible())`:
`findBy…` only waits for an element to exist, not for its enter animation to finish.
Use `readyButton`
from `interactions.ts` before clicking an action after a request: Ant Design
briefly keeps its internal loading state after the request has settled.

The mocked API demonstrates the **client workflow**, not the correctness or
performance of reconciliation in the database. Server reconciliation and
Postgres/e2e suites remain responsible for merging content, provenance,
transactions and persisted history. Do not import server services into stories.

The browser suite runs in the `admin component stories` CI job. Jest remains
the existing unit-test runner; Vitest is scoped to these stories only.

Storybook 10.6's built-in App Router provider uses the old Next layout context.
For Next 16.4 the preview explicitly mocks the public navigation hooks instead.
Recheck this compatibility note when upgrading Storybook. Navigation is recorded
as mock actions and never leaves the workshop.
