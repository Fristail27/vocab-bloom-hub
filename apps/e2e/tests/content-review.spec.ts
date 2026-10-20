import { expect, test } from '@playwright/test';
import { seedWord } from '../helpers/seed';
import { API_URL } from '../config';
import { acknowledgeSourceEditing } from '../helpers/acknowledge-source';

// The review actions themselves go through the browser against an isolated database.
test('checks a definition independently, finds it by review status, and detects an edit', async ({
  page,
  request,
}) => {
  const id = await seedWord(request, 'reviewcheck');
  await acknowledgeSourceEditing(page);
  await page.goto(`/en/managing/edit-word/${id}`);
  const definition = page.getByRole('group', { name: 'Definition', exact: true });
  await expect(definition.getByText('Not checked', { exact: true })).toBeVisible();
  await definition.getByRole('button', { name: 'Mark as checked' }).click();
  await expect(definition.getByText('Checked', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('group', { name: 'Meaning translation', exact: true })
      .getByText('Not checked', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('group', { name: 'Short translation', exact: true })
      .getByText('Not checked', { exact: true }),
  ).toBeVisible();

  await page.goto('/en/managing?search=reviewcheck');
  await page.getByText('Content review', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Review status' }).click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: /^Checked$/ })
    .click();
  const link = page.getByRole('link', { name: 'reviewcheck (verb)' });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/en/managing/edit-word/${id}\\?dataset=default$`));
  await expect(definition.getByText('Checked', { exact: true })).toBeVisible();
  const word = await (await request.get(`${API_URL}/en/${id}`)).json();
  expect(
    (
      await request.patch(`${API_URL}/en/word/meaning`, {
        data: { id: word.meanings[0].id, definition: 'a changed definition' },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await expect(definition.getByText('Changed since checking')).toBeVisible();
  await definition.getByRole('button', { name: 'Confirm again' }).click();
  await expect(definition.getByText('Checked', { exact: true })).toBeVisible();
  await definition.getByRole('button', { name: 'Clear check' }).click();
  await expect(definition.getByText('Not checked', { exact: true })).toBeVisible();
});
