import { expect, test } from '@playwright/test';

// Server-rendered word pages over the public API (issue #330); the data is
// the fixture dictionary seeded in site.setup.ts
test.describe('word pages', () => {
  test('a headword renders its entries from the fixture data', async ({ page }) => {
    await page.goto('/en/word/run');

    await expect(page.getByRole('heading', { level: 1, name: 'run' })).toBeVisible();
    // one seeded entry: the verb, with its meaning and the synonym link
    await expect(page.getByRole('heading', { level: 2, name: 'verb' })).toBeVisible();
    await expect(page.getByText('to move fast').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'sprint' })).toHaveAttribute('href', /\/en\/word\/sprint$/);
    // the page names the API call it renders
    await expect(page.getByText('GET /api/v1/words/run')).toBeVisible();
  });

  test('the word index offers the search and the examples', async ({ page }) => {
    await page.goto('/en/word');

    const search = page.getByRole('search').first();
    await search.getByRole('searchbox').fill('run');
    await search.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('link', { name: 'run', exact: true }).first()).toBeVisible();
  });

  test('a missing headword answers 404', async ({ page }) => {
    const response = await page.goto('/en/word/no-such-headword');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  });

  test('/word/random redirects to a headword', async ({ request }) => {
    const response = await request.get('/en/word/random', { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toMatch(/\/en\/word\/.+$/);
  });

  test('the edit mode of the report form files a form proposal (issue #327)', async ({ page }) => {
    await page.goto('/en/word/abandon');

    // one entry point: the report button, then the edit-the-entry mode
    await page.getByRole('button', { name: 'Report a mistake' }).click();
    const form = page.getByRole('form', { name: 'Report a mistake' });
    await form.getByRole('button', { name: 'Edit the entry' }).click();

    // the full word form opens prefilled; only the changed values are sent
    await form.getByLabel('Description').fill('to leave somebody or something behind for good');
    await form.getByRole('button', { name: 'Suggest the changes' }).click();

    await expect(page.getByText('Thank you — the proposal is in the moderation queue.')).toBeVisible();
  });

  test('the report form files a suggestion into the instance queue (issue #327)', async ({ page }) => {
    await page.goto('/en/word/run');

    await page.getByRole('button', { name: 'Report a mistake' }).click();
    const form = page.getByRole('form', { name: 'Report a mistake' });
    await form
      .getByRole('textbox')
      .fill('The definition of "to move fast" misses that it is on foot — e2e report.');
    await form.getByRole('button', { name: 'Send the report' }).click();

    await expect(page.getByText('Thank you — the report is in the moderation queue.')).toBeVisible();
  });
});
