import { expect, test } from '@playwright/test';

// Every dashboard button must lead to a live page — shipped regressions
// included links pointing at routes that no longer existed
const dashboardLinks = [
  { name: 'Import Dictionary', path: '/en/managing/import-dictionary' },
  { name: 'Export Dictionary', path: '/en/managing/export-dictionary' },
  { name: 'Add word', path: '/en/managing/add-word' },
  { name: 'Bulk request', path: '/en/managing/bulk-request' },
  { name: 'Edit data', path: '/en/managing' },
  { name: 'Common statistics', path: '/en/statistics/common' },
  { name: 'Meanings & translations', path: '/en/statistics/translations' },
  { name: 'Data issues', path: '/en/statistics/issues' },
];

test.describe('dashboard', () => {
  test('the admin shell: noindex, a nav landmark and client-side menu navigation (issue #348)', async ({
    page,
  }) => {
    await page.goto('/en');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const nav = page.getByRole('navigation', { name: 'Menu' });
    await nav.getByRole('link', { name: 'History' }).click();
    await page.waitForURL('**/en/history');
    // soft navigation, and the open page is marked for assistive tech
    await expect(nav.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
  });

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

// The project icon instead of the framework's default favicon: the page links
// it and the file answers as SVG (the proxy leaves paths with a dot alone)
test('the admin serves the project favicon', async ({ page, request }) => {
  await page.goto('/en');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /\/icon\.svg/);

  const icon = await request.get('/icon.svg');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('svg');
});

// The footer used to carry a dead "Docs" label, an icon class of a library the
// app does not ship, and an empty version on the login page (the settings
// endpoint is admin-only, so the build's own version is the fallback)
test('the footer links the docs and the repository and always shows a version', async ({ page, browser }) => {
  await page.goto('/en');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Docs' })).toHaveAttribute(
    'href',
    'https://vocab-bloom-hub.com/en/docs',
  );
  await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /github\.com/);
  await expect(footer).toContainText(/Version: \d+\.\d+\.\d+/);

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const login = await anonymous.newPage();
  await login.goto(new URL('/en/login', page.url()).toString());
  await expect(login.locator('footer')).toContainText(/Version: \d+\.\d+\.\d+/);
  await anonymous.close();
});

test('the header logo leads home and the switches have accessible names', async ({ page }) => {
  await page.goto('/en/managing');
  await expect(page.getByRole('switch', { name: 'Dark theme' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Interface language' })).toBeVisible();
  await page.getByRole('link', { name: 'Home' }).click();
  await page.waitForURL(/\/en\/?$/);
});
