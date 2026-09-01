import { expect, test } from '@playwright/test';

// The settings page (issue #347): the full CRUD over the key-value table,
// with the virtual `version` row staying read-only
test.describe('settings management', () => {
  test('adds, edits and deletes a field through the UI', async ({ page }) => {
    await page.goto('/en/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // the app version is config, not a row the admin can touch
    const versionRow = page.getByRole('row').filter({ has: page.locator('code', { hasText: /^version$/ }) });
    await expect(versionRow).toHaveCount(1);
    await expect(versionRow.getByRole('button')).toHaveCount(0);

    // add
    await page.getByPlaceholder('field name').fill('e2e_theme');
    await page.getByPlaceholder('value').fill('dark');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Field added')).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: 'e2e_theme' });
    await expect(row).toContainText('dark');

    // edit through the modal
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('light');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Field updated')).toBeVisible();
    await expect(row).toContainText('light');

    // delete through the confirmation
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Field deleted')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'e2e_theme' })).toHaveCount(0);
  });

  test('a duplicate field is refused with the API error', async ({ page }) => {
    await page.goto('/en/settings');

    await page.getByPlaceholder('field name').fill('e2e_dup');
    await page.getByPlaceholder('value').fill('1');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Field added')).toBeVisible();

    await page.getByPlaceholder('field name').fill('e2e_dup');
    await page.getByPlaceholder('value').fill('2');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Field already exists')).toBeVisible();
  });
});
