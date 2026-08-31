import { expect, test } from '@playwright/test';

// One documentation page end to end: the sidebar, the table of contents and
// the highlighted code of the build-time Markdown rendering (issue #330)
test.describe('documentation', () => {
  test('a docs page renders with sidebar, table of contents and highlighted code', async ({ page }) => {
    await page.goto('/en/docs/observability');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Observability: metrics and logs');

    // the sidebar marks the open page
    const active = page.locator('aside nav a[aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('href', /\/en\/docs\/observability$/);

    // the table of contents links the in-page headings
    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc.getByRole('link', { name: 'Logs' })).toHaveAttribute('href', '#logs');

    // fenced code went through rehype-highlight
    await expect(page.locator('.markdown pre code.hljs').first()).toBeVisible();
  });

  test('the docs index lists the sections', async ({ page }) => {
    await page.goto('/en/docs');

    for (const section of ['Getting started', 'Deployment', 'API and SDKs']) {
      await expect(page.locator('aside').getByRole('heading', { name: section, exact: true })).toBeVisible();
    }
  });

  test('a page without a Russian translation says so', async ({ page }) => {
    await page.goto('/ru/docs/observability');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByText('Эта страница доступна только на английском.')).toBeVisible();
  });
});
