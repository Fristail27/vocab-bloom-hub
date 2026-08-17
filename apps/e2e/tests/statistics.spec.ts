import { expect, test } from '@playwright/test';

import { seedWord } from '../helpers/seed';

test.describe('statistics', () => {
  test('common statistics page renders the totals and coverage blocks', async ({ page, request }) => {
    await seedWord(request, 'glimmer');

    await page.goto('/en/statistics/common');

    await expect(page.getByText('Dictionary entries')).toBeVisible();
    await expect(page.getByText('Words with meanings')).toBeVisible();
    await expect(page.getByText('By part of speech')).toBeVisible();
  });

  test('translations statistics page renders its blocks', async ({ page, request }) => {
    await seedWord(request, 'shimmer');

    await page.goto('/en/statistics/translations');

    await expect(page.getByText('By translation language')).toBeVisible();
    await expect(page.getByText('Meanings per word (avg.)')).toBeVisible();
  });

  test('issues statistics page renders', async ({ page }) => {
    await page.goto('/en/statistics/issues');

    await expect(page.getByText('Incomplete or empty data')).toBeVisible();
  });
});
