import { expect, test } from '@playwright/test';

const og = (page: import('@playwright/test').Page, property: string) =>
  page.locator(`meta[property="${property}"]`);

// OpenGraph / Twitter metadata of the website (issues #332, #480): a shared
// link renders a card on every page — the type, the site name, the URL and
// the image generated per locale — not only on the landing
test.describe('social metadata', () => {
  test('the landing carries the default card and a title of its own words', async ({ page }) => {
    await page.goto('/en');

    await expect(page).toHaveTitle('Vocab Bloom Hub — a self-hosted English dictionary with a public API');
    await expect(og(page, 'og:site_name')).toHaveAttribute('content', 'Vocab Bloom Hub');
    await expect(og(page, 'og:type')).toHaveAttribute('content', 'website');
    await expect(og(page, 'og:image')).toHaveAttribute('content', /\/en\/opengraph-image/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  });

  test('every kind of page keeps the whole card', async ({ page }) => {
    const routes: Array<[string, string]> = [
      ['/en/docs', 'website'],
      ['/en/docs/api', 'article'],
      ['/en/api', 'website'],
      ['/en/playground', 'website'],
      ['/en/word', 'website'],
      ['/en/word/run', 'article'],
      ['/en/word/browse', 'website'],
      ['/en/word/browse/r', 'website'],
      ['/ru/word/run', 'article'],
    ];
    for (const [route, type] of routes) {
      await page.goto(route);
      const locale = route.split('/')[1];
      await expect(og(page, 'og:type'), route).toHaveAttribute('content', type);
      await expect(og(page, 'og:site_name'), route).toHaveAttribute('content', 'Vocab Bloom Hub');
      await expect(og(page, 'og:locale'), route).toHaveAttribute('content', locale as string);
      await expect(og(page, 'og:url'), route).toHaveAttribute('content', `http://localhost:3021${route}`);
      await expect(og(page, 'og:image'), route).toHaveCount(1);
      await expect(og(page, 'og:image'), route).toHaveAttribute(
        'content',
        `http://localhost:3021/${locale}/opengraph-image`,
      );
      await expect(page.locator('meta[name="twitter:image"]'), route).toHaveCount(1);
      await expect(og(page, 'og:description'), route).not.toHaveAttribute('content', '');
    }
  });

  test('a word page refines the card with the headword and the definition', async ({ page }) => {
    await page.goto('/en/word/run');

    await expect(og(page, 'og:title')).toHaveAttribute('content', 'run — meanings, forms, translations');
    await expect(og(page, 'og:description')).toHaveAttribute('content', /to move fast/);
  });

  test('the generated card image answers with a PNG', async ({ page, request }) => {
    await page.goto('/en');
    const image = await og(page, 'og:image').getAttribute('content');
    expect(image).toBeTruthy();

    const response = await request.get(image as string);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  });
});
