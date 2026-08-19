import { expect, test } from '@playwright/test';

import { seedWord } from '../helpers/seed';

test.describe('documentation', () => {
  test('index page lists every documented public endpoint', async ({ page }) => {
    await page.goto('/en/documentation');

    await expect(page.getByRole('link', { name: 'Basic search' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Detailed search' })).toBeVisible();
    // the auth routes are admin plumbing, not part of the public API
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  });

  test('endpoint page describes the request filters', async ({ page }) => {
    await page.goto('/en/documentation/search-detailed');

    // the same path also shows up inside the curl example below
    await expect(page.getByText('/api/en/search/detailed', { exact: true })).toBeVisible();
    await expect(page.getByText('Up to 30 requests per 10 s')).toBeVisible();

    const params = page.getByRole('table').first();
    await expect(params.getByText('with_meanings')).toBeVisible();
    await expect(params.getByText('translation_languages')).toBeVisible();
    // limit and page share the same range
    await expect(params.getByText('1–20').first()).toBeVisible();
  });

  test('runs a real request and shows the answer as json and as a table', async ({ page, request }) => {
    await seedWord(request, 'flicker');

    await page.goto('/en/documentation/search-detailed');

    await page.getByRole('textbox').first().fill('flicker');
    await page.getByRole('switch', { name: 'with_meanings' }).click();
    await page.getByRole('button', { name: 'Send request' }).click();

    await expect(page.getByText('"word": "flicker"')).toBeVisible();
    await expect(page.getByText('"has_more": false')).toBeVisible();
    // the joined meaning proves the filter reached the database
    await expect(page.getByText('"title": "flicker meaning"')).toBeVisible();

    await page.getByText('Table', { exact: true }).click();

    await expect(page.getByRole('cell', { name: 'flicker', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'has_more' })).toBeVisible();
  });

  test('unknown endpoint slug renders the not found page', async ({ page }) => {
    await page.goto('/en/documentation/nope');

    await expect(page.getByText('Page not found')).toBeVisible();
  });
});
