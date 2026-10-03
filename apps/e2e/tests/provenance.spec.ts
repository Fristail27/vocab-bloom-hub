import { expect, test } from '@playwright/test';
import { API_URL } from '../config';
import { seedWord } from '../helpers/seed';

test('warns before source editing and saves manual word attribution with a correction reason', async ({
  page,
  request,
}) => {
  const id = await seedWord(request, 'provenance-example');
  await page.goto(`/en/managing/edit-word/${id}`);
  const warning = page.getByRole('dialog', { name: 'Editing a source dataset' });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole('button', { name: 'Create fork' })).toBeVisible();
  await warning.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/managing\/datasets$/);
  await page.goto(`/en/managing/edit-word/${id}`);
  await warning.getByRole('button', { name: 'Continue editing' }).click();
  await expect(warning).not.toBeVisible();
  await expect(page.getByText('This dataset receives source updates.', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit sources and licenses' }).click();
  const editor = page.getByRole('dialog', { name: 'Sources and licenses', exact: true });
  await expect(editor.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Add source', exact: true }).click();
  const source = page.getByRole('dialog', { name: 'Add source', exact: true });
  await source.getByRole('textbox', { name: /Source name$/ }).fill('External glossary');
  await source.getByRole('textbox', { name: 'Source version', exact: true }).fill('2026.1');
  await source.getByRole('textbox', { name: 'Source link', exact: true }).fill('https://example.org/glossary');
  await source
    .getByRole('textbox', { name: 'Original word link', exact: true })
    .fill('https://example.org/glossary/word');
  await source.getByRole('textbox', { name: /Attribution$/ }).fill('Example contributors');
  await source.getByRole('textbox', { name: 'Required notices and copyright' }).fill('Keep this attribution.');
  await source.getByRole('button', { name: 'Add license' }).click();
  const license = page.getByRole('dialog', { name: 'Add license', exact: true });
  await expect(license.getByRole('textbox', { name: 'Source version' })).toHaveCount(0);
  await expect(license.getByRole('textbox', { name: 'Source link' })).toHaveCount(0);
  await expect(license.getByRole('textbox', { name: 'Original word link' })).toHaveCount(0);
  await license.getByRole('combobox', { name: /License$/ }).click();
  await page.getByText('Custom license', { exact: true }).click();
  await license.getByRole('textbox', { name: /License name$/ }).fill('Glossary license');
  await license.getByRole('textbox', { name: /License link$/ }).fill('https://example.org/license');
  await license.getByRole('textbox', { name: /Full license text$/ }).fill('Keep attribution when reusing.');
  await license.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(license).not.toBeVisible();
  await expect(source).toBeVisible();
  await source.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(source).not.toBeVisible();
  await editor
    .getByRole('textbox', { name: 'Reason for the correction' })
    .fill('Examples were transferred manually.');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor).not.toBeVisible();
  const saved = await (await request.get(`${API_URL}/en/${id}`)).json();
  expect(saved.origins).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'External glossary',
        version: '2026.1',
        url: 'https://example.org/glossary',
        record_url: 'https://example.org/glossary/word',
        inherited: false,
        method: 'manual',
        attribution: 'Example contributors',
        notices: ['Keep this attribution.'],
      }),
    ]),
  );
  const licenses = saved.origins.find(
    (origin: { name: string }) => origin.name === 'External glossary',
  ).licenses;
  expect(licenses).toHaveLength(2);
  expect(licenses[1]).toEqual({
    name: 'Glossary license',
    url: 'https://example.org/license',
    text: 'Keep attribution when reusing.',
  });
  const history = await (await request.get(`${API_URL}/en/changes?headword=provenance-example`)).json();
  expect(history.items[0].reason).toBe('Examples were transferred manually.');
  await page.reload();
  await expect(warning).not.toBeVisible();
  await expect(page.getByText('External glossary', { exact: false }).first()).toBeVisible();
});
