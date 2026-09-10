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

  // the locales of issue #450: the hero in Spanish and German, the html lang attribute
  test('renders in Spanish and German', async ({ page }) => {
    await page.goto('/es');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Un diccionario que puedes ejecutar junto a tu aplicación',
    );

    await page.goto('/de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Ein Wörterbuch, das neben deiner App läuft',
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
