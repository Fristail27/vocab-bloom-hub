import { expect, test } from '@playwright/test';

import { API_URL } from '../config';
import { seedWord } from '../helpers/seed';

// The moderation queue of reader reports (issue #327): a report filed
// through the public API shows up on the admin page and takes a verdict
test.describe('suggestions moderation', () => {
  test('a filed report is listed, resolved and disappears from the default view', async ({ page, request }) => {
    await seedWord(request, 'glisten');
    const filed = await request.post(`${API_URL}/v1/suggestions`, {
      data: {
        headword: 'glisten',
        message: 'The example sentence sounds unnatural — e2e moderation check.',
      },
    });
    expect(filed.status()).toBe(201);

    await page.goto('/en/suggestions');
    const row = page.getByRole('row').filter({ hasText: 'glisten' });
    await expect(row).toHaveCount(1);
    await expect(row.getByText('new')).toBeVisible();

    await row.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByText('Marked resolved')).toBeVisible();
    // the default filter shows new reports only, so the resolved one leaves
    await expect(page.getByRole('row').filter({ hasText: 'glisten' })).toHaveCount(0);
  });

  test('an edit suggestion shows its diff and applies in one click (issue #327)', async ({ page, request }) => {
    const wordId = await seedWord(request, 'quiver');
    const filed = await request.post(`${API_URL}/v1/suggestions`, {
      data: {
        headword: 'quiver',
        kind: 'edit',
        edits: [
          {
            target_type: 'word',
            target_id: wordId,
            changes: { description: 'to shine with a soft wavering light' },
          },
        ],
      },
    });
    expect(filed.status()).toBe(201);

    await page.goto('/en/suggestions');
    const row = page.getByRole('row').filter({ hasText: 'quiver' });
    // the stored diff renders as before → after
    await expect(row.getByText('to shine with a soft wavering light')).toBeVisible();

    await row.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Applied — the entry is updated and marked as yours')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'quiver' })).toHaveCount(0);

    // the word really changed, through the normal edit flow
    const word = await request.get(`${API_URL}/en/${wordId}`);
    const body = (await word.json()) as { description: string; user_modified: boolean };
    expect(body.description).toBe('to shine with a soft wavering light');
    expect(body.user_modified).toBe(true);
  });
});
