import { expect, test } from '@playwright/test';

import { seedWord } from '../helpers/seed';

test.describe('statistics', () => {
  test('all datasets overview opens details and keeps the dataset through navigation', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'edited_dataset', value: 'does_not_exist', domain: 'localhost', path: '/' }]);
    await page.goto('/en/statistics/datasets');
    const dataset = page.getByTestId('statistics-default');
    await expect(dataset).toBeVisible();
    await expect(page.getByTestId('edited-dataset')).toHaveCount(0);
    await expect(dataset.getByText('Dictionary entries', { exact: true })).toBeVisible();
    await dataset.getByRole('link', { name: 'Common statistics', exact: true }).click();
    await expect(page).toHaveURL(/statistics\/common\?dataset=default$/);
    await expect(page.getByText('Dictionary entries', { exact: true })).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'Dataset statistics' });
    await navigation.getByRole('link', { name: 'Meanings & translations', exact: true }).click();
    await expect(page).toHaveURL(/statistics\/translations\?dataset=default$/);
    await expect(page.getByText('By translation language', { exact: true })).toBeVisible();
    await navigation.getByRole('link', { name: 'Data issues', exact: true }).click();
    await expect(page).toHaveURL(/statistics\/issues\?dataset=default$/);
    await expect(page.getByText('Incomplete or empty data', { exact: true })).toBeVisible();
    await navigation.getByRole('link', { name: 'All datasets', exact: true }).click();
    await expect(dataset).toBeVisible();
  });

  test('common statistics page renders the totals and coverage blocks', async ({ page, request }) => {
    await seedWord(request, 'glimmer');

    await page.goto('/en/statistics/common');

    await expect(page.getByText('Dictionary entries')).toBeVisible();
    await expect(page.getByText('Words with meanings')).toBeVisible();
    await expect(page.getByText('By part of speech')).toBeVisible();
  });

  test('translations statistics page renders its blocks', async ({ page, request }) => {
    await seedWord(request, 'shimmer');

    await page.goto('/en/statistics/translations');

    await expect(page.getByText('By translation language')).toBeVisible();
    await expect(page.getByText('Meanings per word (avg.)')).toBeVisible();
  });

  test('issues statistics page renders', async ({ page }) => {
    await page.goto('/en/statistics/issues');

    await expect(page.getByText('Incomplete or empty data')).toBeVisible();
  });
  test('opens matching records, corrects a word and refreshes the list on return', async ({
    page,
    request,
  }) => {
    const word = 'qualityinspection';
    await seedWord(request, word, { transcription: '', forms: [] });
    await page.goto('/en/statistics/issues');
    await page.getByRole('link', { name: 'Words without transcription', exact: true }).click();
    await expect(page).toHaveURL(/dataset=default.*category=words_without_transcription/);
    await page.getByRole('link', { name: new RegExp(`${word}.*Open editor`) }).click();
    await expect(page).toHaveURL(/edit-word.*dataset=default.*category=words_without_transcription.*page=1/);
    await page
      .getByRole('dialog', { name: 'Editing a source dataset' })
      .getByRole('button', { name: 'Continue editing' })
      .click();
    await page.getByRole('button', { name: 'Edit Common Data' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Pronunciation').fill('inspection');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('link', { name: 'Back to matching records' }).click();
    await expect(page.getByText('Matching records:', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(`${word}.*Open editor`) })).toHaveCount(0);
  });

  test('opens the precise meaning, and keeps page and category when returning', async ({ page, request }) => {
    const word = 'qualitymeaning';
    await seedWord(request, word, {
      forms: [],
      meanings: Array.from({ length: 26 }, (_, index) => ({
        title: index === 25 ? 'Second distinct sense' : `First distinct sense ${index}`,
        definition: index === 25 ? 'Second definition' : `First definition ${index}`,
        is_obsolete: false,
        sort_order: index,
        examples: [],
        area_variant: 'common',
        translations: [],
      })),
    });
    await page.goto('/en/statistics/issues?dataset=default&category=meanings_without_examples&page=2');
    const row = page.getByRole('listitem').filter({ hasText: 'Second distinct sense' });
    await row.getByRole('link', { name: /Open editor/ }).click();
    await expect(page).toHaveURL(/#meaning-\d+$/);
    await page
      .getByRole('dialog', { name: 'Editing a source dataset' })
      .getByRole('button', { name: 'Continue editing' })
      .click();
    const hash = new URL(page.url()).hash;
    await expect(page.locator(hash)).toContainText('Second distinct sense');
    await page.getByRole('link', { name: 'Back to matching records' }).click();
    await expect(page).toHaveURL(/category=meanings_without_examples.*page=2/);
    await expect(page.getByText('Second distinct sense — Second definition')).toBeVisible();
  });
});
