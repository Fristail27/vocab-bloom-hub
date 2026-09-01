import { expect, test } from '@playwright/test';

// The SEO last mile (issue #350): favicon, canonical/hreflang, structured
// data, the word sitemap and the styled 404 for unmatched URLs
test.describe('seo', () => {
  test('a word page carries canonical, hreflang and structured data; the favicon answers', async ({
    page,
    request,
  }) => {
    await page.goto('/en/word/run');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/word\/run$/);
    await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveAttribute(
      'href',
      /\/ru\/word\/run$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      /\/en\/word\/run$/,
    );

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toContain('"DefinedTerm"');
    expect(jsonLd).toContain('"run"');

    const icon = await request.get('/icon.svg');
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toContain('svg');
  });

  test('robots lists both sitemaps and the word sitemap walks the dictionary', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('/sitemap.xml');
    expect(robots).toContain('/sitemap-words.xml');

    const sitemap = await (await request.get('/sitemap-words.xml')).text();
    expect(sitemap).toContain('/en/word/run</loc>');
    expect(sitemap).toContain('/ru/word/run</loc>');
  });

  test('an unmatched URL renders the styled 404, not the framework default', async ({ page }) => {
    const response = await page.goto('/en/dcos');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
    await expect(page.getByRole('link', { name: 'Back to the start page' })).toBeVisible();
  });
});
