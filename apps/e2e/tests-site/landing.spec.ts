import { expect, test } from '@playwright/test';

// The landing in both locales and the language switch (issue #330)
test.describe('landing', () => {
  test('renders in English and links the main journeys', async ({ page }) => {
    await page.goto('/');
    // the middleware always prefixes the locale
    await page.waitForURL('**/en');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'A dictionary you can run next to your app',
    );
    await expect(page.getByRole('link', { name: 'Install with Docker' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try the API' })).toBeVisible();
    // the header navigation
    for (const name of ['Docs', 'API', 'Playground', 'Words']) {
      await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
    }
  });

  test('renders in Russian', async ({ page }) => {
    await page.goto('/ru');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Словарь, который можно поднять рядом со своим приложением',
    );
  });

  test('the language switch keeps the page', async ({ page }) => {
    await page.goto('/en/playground');

    await page.getByRole('link', { name: 'ru', exact: true }).click();
    await page.waitForURL('**/ru/playground');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    await page.getByRole('link', { name: 'en', exact: true }).click();
    await page.waitForURL('**/en/playground');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
