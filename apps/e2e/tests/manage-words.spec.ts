import { expect, test } from '@playwright/test';

import { API_URL } from '../config';
import { seedWord } from '../helpers/seed';

test.describe('word management', () => {
  test('search finds a seeded word with its forms', async ({ page, request }) => {
    await seedWord(request, 'blossom');

    await page.goto('/en/managing');
    await page.getByRole('textbox').fill('blossom');

    await expect(page.getByText('blossom', { exact: true })).toBeVisible();
    // the word form tag rendered next to the base word
    await expect(page.getByText('blossomed', { exact: true })).toBeVisible();
    await expect(page.getByText('verb').first()).toBeVisible();
  });

  test('shows the card of an existing word on the edit page', async ({ page, request }) => {
    const id = await seedWord(request, 'wander');

    await page.goto(`/en/managing/edit-word/${id}`);

    await expect(page.getByText('wander').first()).toBeVisible();
    await expect(page.getByText('wander meaning')).toBeVisible();
    await expect(page.getByText('перевод wander').first()).toBeVisible();
  });

  test('deletes a word from the search results together with its data', async ({ page, request }) => {
    const id = await seedWord(request, 'vanish');

    await page.goto('/en/managing');
    await page.getByRole('textbox').fill('vanish');
    await expect(page.getByText('vanish', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'delete' }).click();
    await page.getByRole('button', { name: 'Delete word' }).click();

    await expect(page.getByText('Word deleted successfully')).toBeVisible();
    await expect(page.getByText('vanish', { exact: true })).toHaveCount(0);

    // the API no longer serves the word — the delete really cascaded
    const res = await request.get(`${API_URL}/en/${id}`);
    expect(res.status()).toBe(404);
  });
});
