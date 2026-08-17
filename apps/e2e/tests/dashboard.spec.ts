import { expect, test } from '@playwright/test';

// Every dashboard button must lead to a live page — shipped regressions
// included links pointing at routes that no longer existed
const dashboardLinks = [
  { name: 'Import Dictionary', path: '/en/managing/import-dictionary' },
  { name: 'Export Dictionary', path: '/en/managing/export-dictionary' },
  { name: 'Add word', path: '/en/managing/add-word' },
  { name: 'Edit data', path: '/en/managing' },
  { name: 'Common statistics', path: '/en/statistics/common' },
  { name: 'Meanings & translations', path: '/en/statistics/translations' },
  { name: 'Data issues', path: '/en/statistics/issues' },
];

test.describe('dashboard', () => {
  for (const link of dashboardLinks) {
    test(`link "${link.name}" opens a real page`, async ({ page }) => {
      await page.goto('/en');
      await page.getByRole('link', { name: link.name, exact: true }).click();

      await page.waitForURL(`**${link.path}`);
      await expect(page.getByText('This page could not be found')).toHaveCount(0);
      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  }
});
