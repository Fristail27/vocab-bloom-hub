import { expect, test } from '@playwright/test';
import { API_URL } from '../config';
import { seedWord } from '../helpers/seed';

test('reviews an update, resumes saved decisions and publishes the accepted result', async ({
  page,
  request,
}, testInfo) => {
  const word = `e2ereconciliation${testInfo.retry}`;
  const id = await seedWord(request, word, {
    description: 'Local text',
    forms: [],
    meanings: [],
    short_translations: [],
  });
  const upload = await request.post(`${API_URL}/en/dictionary/import/upload`, {
    multipart: {
      words: {
        name: 'words.jsonl',
        mimeType: 'application/x-ndjson',
        buffer: Buffer.from(
          `${JSON.stringify({ word, part_of_speech: 'verb', description: 'Incoming text', generated: false, forms: [], meanings: [], short_translations: [], version: '2.0.0' })}\n`,
        ),
      },
    },
  });
  expect(upload.ok(), await upload.text()).toBeTruthy();
  const completed = JSON.parse((await upload.text()).trim().split('\n').at(-1)!);
  expect(completed.reconciliation_plan).toBeTruthy();
  const read = async () => (await (await request.get(`${API_URL}/en/${id}`)).json()).description;
  expect(await read()).toBe('Local text');
  const open = async () => {
    await page.goto('/en/managing/datasets');
    await page.getByTestId('dataset-default').getByRole('button', { name: 'Updates and merges' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Operations' }).click();
    await page.locator('.ant-select-item-option-content').first().click();
    return dialog;
  };
  let dialog = await open();
  await dialog.getByText(word, { exact: false }).filter({ hasNotText: 'Changes to apply' }).first().click();
  await expect(dialog.getByText('Local text', { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText('Incoming text', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Accept incoming', exact: true }).last().click();
  await dialog.getByRole('button', { name: 'Save decisions', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Apply update', exact: true })).toBeEnabled();
  expect(await read()).toBe('Local text');
  dialog = await open();
  await expect(dialog.getByRole('button', { name: 'Apply update', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Apply update', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Apply update', exact: true })).toBeHidden();
  expect(await read()).toBe('Incoming text');
  const history = await (await request.get(`${API_URL}/en/changes?headword=${word}`)).json();
  expect(
    history.items.some(
      (row: { operation?: { id: string } }) => row.operation?.id === completed.reconciliation_plan,
    ),
  ).toBeTruthy();
});
