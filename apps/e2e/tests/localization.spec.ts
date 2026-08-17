import { expect, test } from '@playwright/test';

test.describe('localization', () => {
  test('the managing page is translated per locale', async ({ page }) => {
    await page.goto('/en/managing');
    await expect(page.getByText('Dictionary search')).toBeVisible();

    await page.goto('/ru/managing');
    await expect(page.getByText('Поиск в словаре')).toBeVisible();
  });

  test('the root path redirects to the default locale', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/en');
  });
});
