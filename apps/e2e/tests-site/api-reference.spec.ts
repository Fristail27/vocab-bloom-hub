import { expect, test } from '@playwright/test';

// The API reference generated from apps/server/openapi/public-v1.json:
// operation and schema anchors must keep resolving (issue #330)
test.describe('API reference', () => {
  test('an operation anchor resolves and links the playground', async ({ page }) => {
    await page.goto('/en/api#get-words-word');

    const operation = page.locator('section#get-words-word');
    await expect(operation).toBeVisible();
    await expect(operation.getByRole('heading', { level: 3 })).toContainText('/api/v1/words/{word}');
    await expect(operation.getByRole('link', { name: /playground/i })).toHaveAttribute(
      'href',
      /\/en\/playground\?endpoint=get-words-word$/,
    );
  });

  test('a schema link from the endpoint list resolves', async ({ page }) => {
    await page.goto('/en/api');

    // the sidebar of the reference lists every schema as an in-page anchor
    await page.locator('a[href="#schema-PublicWordV1T"]').first().click();
    await expect(page.locator('[id="schema-PublicWordV1T"]')).toBeVisible();
  });
});
