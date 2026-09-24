import { expect, test } from '@playwright/test';

// The site navigation on a phone (issue #520): a menu behind a button, the
// same links; on a wide screen the row of links as before
test.describe('header navigation', () => {
  test('on a phone the links sit behind a menu button that closes on navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/docs');

    const toggle = page.getByRole('button', { name: 'Menu' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const docs = page.locator('header').getByRole('link', { name: 'Playground', exact: true });
    await expect(docs).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(docs).toBeVisible();
    // the language switch is in the menu too
    await expect(page.locator('header').getByRole('link', { name: 'ru', exact: true })).toBeVisible();

    await docs.click();
    await expect(page).toHaveURL(/\/en\/playground$/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(docs).toBeHidden();

    // Escape closes it as well
    await toggle.click();
    await expect(docs).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(docs).toBeHidden();
  });

  test('on a wide screen the links are in the header, no button', async ({ page }) => {
    await page.goto('/en/docs');

    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    for (const name of ['Docs', 'API', 'Playground', 'Words', 'SDK', 'GitHub']) {
      await expect(page.locator('header').getByRole('link', { name, exact: true })).toBeVisible();
    }
  });
});
