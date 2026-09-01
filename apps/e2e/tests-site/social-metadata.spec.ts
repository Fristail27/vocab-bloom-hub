import { expect, test } from '@playwright/test';

const og = (page: import('@playwright/test').Page, property: string) =>
  page.locator(`meta[property="${property}"]`);

// OpenGraph / Twitter metadata of the website (issue #332): a shared link
// renders a card — the defaults come from the root layout, the word pages
// refine the title and description, the image is generated per locale
test.describe('social metadata', () => {
  test('the landing carries the default card', async ({ page }) => {
    await page.goto('/en');

    await expect(og(page, 'og:site_name')).toHaveAttribute('content', 'Vocab Bloom Hub');
    await expect(og(page, 'og:type')).toHaveAttribute('content', 'website');
    await expect(og(page, 'og:image')).toHaveAttribute('content', /\/en\/opengraph-image/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
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
