import { APIRequestContext, expect, Page, test } from '@playwright/test';

import { API_URL } from '../config';
import { seedWord } from '../helpers/seed';

// Edit and delete flows of the word card (issue #243 follow-up): every entity
// that word-crud.spec.ts creates through the UI is also edited and deleted
// through its card modal here, with the persisted result verified via the API.

const getWord = async (request: APIRequestContext, id: number) => {
  const res = await request.get(`${API_URL}/en/${id}`);
  expect(res.ok()).toBe(true);
  return res.json();
};

// The whole word-card section (title bar + content). The strong title text
// nests as span > strong inside the section's title div, so the section
// container is two div levels up from the matched <strong>
const wordCardSection = (page: Page, title: string) =>
  page.getByText(title, { exact: true }).locator('xpath=ancestor::div[2]');

test.describe('UI-driven word edit and delete', () => {
  test('edits a short translation through the card modal and persists it', async ({ page, request }) => {
    const id = await seedWord(request, 'perish');

    await page.goto(`/en/managing/edit-word/${id}`);
    // The only translation card in the section carries one edit button
    await wordCardSection(page, 'Short Translations').getByRole('button', { name: 'edit' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Editing Short Translation')).toBeVisible();
    await dialog.locator('textarea').fill('погибать, исчезать');
    await dialog.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText('Short translation updated')).toBeVisible();
    await expect(page.getByRole('main').getByText('погибать, исчезать')).toBeVisible();

    const word = await getWord(request, id);
    expect(word.short_translations).toEqual([
      expect.objectContaining({ language: 'ru', description: 'погибать, исчезать' }),
    ]);
  });

  test('deletes a short translation through the confirmation modal', async ({ page, request }) => {
    const id = await seedWord(request, 'crumble', {
      short_translations: [{ language: 'ru', description: 'краткий перевод crumble', variants_of_words: [] }],
    });

    await page.goto(`/en/managing/edit-word/${id}`);
    const section = wordCardSection(page, 'Short Translations');
    await expect(section.getByText('краткий перевод crumble')).toBeVisible();
    await section.getByRole('button', { name: 'close' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();

    // Deleting a short translation shows no toast — the card just re-renders
    await expect(section.getByText('краткий перевод crumble')).toBeHidden();

    const word = await getWord(request, id);
    expect(word.short_translations).toEqual([]);
  });

  test('edits a meaning through the card modal and persists it', async ({ page, request }) => {
    const id = await seedWord(request, 'mend');

    await page.goto(`/en/managing/edit-word/${id}`);
    // The first edit button in the section belongs to the meaning itself;
    // the later ones belong to its translations
    await wordCardSection(page, 'Word Meanings').getByRole('button', { name: 'edit' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Editing Meaning')).toBeVisible();
    await dialog.getByRole('textbox').first().fill('to repair');
    await dialog.locator('textarea').fill('to fix something that is broken');
    await dialog.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText('Meaning updated')).toBeVisible();
    await expect(page.getByRole('main').getByText('to repair')).toBeVisible();

    const word = await getWord(request, id);
    expect(word.meanings).toEqual([
      expect.objectContaining({ title: 'to repair', definition: 'to fix something that is broken' }),
    ]);
    // Editing the meaning must not touch its translations
    expect(word.meanings[0].translations).toHaveLength(1);
  });

  test('deletes a meaning through the confirmation modal', async ({ page, request }) => {
    const id = await seedWord(request, 'fade');

    await page.goto(`/en/managing/edit-word/${id}`);
    const section = wordCardSection(page, 'Word Meanings');
    await expect(section.getByText('fade meaning')).toBeVisible();
    // The first close button deletes the meaning; the later ones its translations
    await section.getByRole('button', { name: 'close' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText('Meaning deleted successfully')).toBeVisible();
    await expect(section.getByText('fade meaning')).toBeHidden();

    const word = await getWord(request, id);
    expect(word.meanings).toEqual([]);
  });

  test('edits a meaning translation through the card modal and persists it', async ({ page, request }) => {
    const id = await seedWord(request, 'soothe');

    await page.goto(`/en/managing/edit-word/${id}`);
    // Edit buttons in the meanings section: [0] the meaning, [1] its translation
    await wordCardSection(page, 'Word Meanings').getByRole('button', { name: 'edit' }).nth(1).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Editing Meaning Translation')).toBeVisible();
    await dialog.getByRole('textbox').first().fill('успокаивать');
    await dialog.locator('textarea').fill('снимать боль или волнение');
    await dialog.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText('Meaning Translation updated')).toBeVisible();
    await expect(page.getByRole('main').getByText('успокаивать')).toBeVisible();

    const word = await getWord(request, id);
    expect(word.meanings[0].translations).toEqual([
      expect.objectContaining({
        language: 'ru',
        title: 'успокаивать',
        definition: 'снимать боль или волнение',
        // Untouched fields survive the edit
        variants_of_words: ['перевод-soothe'],
      }),
    ]);
  });

  test('deletes a meaning translation through the confirmation modal', async ({ page, request }) => {
    const id = await seedWord(request, 'scatter');

    await page.goto(`/en/managing/edit-word/${id}`);
    const section = wordCardSection(page, 'Word Meanings');
    // Close buttons in the meanings section: [0] the meaning, [1] its translation
    await section.getByRole('button', { name: 'close' }).nth(1).click();
    await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText('Meaning Translation deleted successfully')).toBeVisible();
    await expect(section.getByText('перевод scatter')).toBeHidden();

    const word = await getWord(request, id);
    expect(word.meanings).toHaveLength(1);
    expect(word.meanings[0].translations).toEqual([]);
  });

  test('adds and removes synonyms / antonyms inline on the card (issue #266)', async ({ page, request }) => {
    // the link targets must exist before the word that links to them
    await seedWord(request, 'twinkle');
    await seedWord(request, 'blacken');
    const id = await seedWord(request, 'sparkle', {
      meanings: [
        {
          title: 'sparkle meaning',
          definition: 'definition of sparkle',
          is_obsolete: false,
          sort_order: 1,
          examples: [],
          area_variant: 'common',
          synonyms: ['twinkle'],
          translations: [],
        },
      ],
    });

    await page.goto(`/en/managing/edit-word/${id}`);
    const section = wordCardSection(page, 'Word Meanings');
    // each relation is one row: its label, the linked-word tags and the controls
    const row = (label: string) => section.getByText(label, { exact: true }).locator('xpath=..');
    await expect(row('Synonyms:').getByRole('link', { name: 'twinkle' })).toBeVisible();

    // add an antonym through the inline picker; the dropdown shows the part of speech
    await row('Antonyms:').getByRole('button', { name: 'plus' }).click();
    await row('Antonyms:').getByRole('combobox').fill('bla');
    const option = page.locator('.ant-select-item-option-content').filter({ hasText: 'blacken' });
    await expect(option).toContainText('verb');
    await option.click();
    await expect(page.getByText('Meaning updated').first()).toBeVisible();
    await row('Antonyms:').getByRole('button', { name: 'check' }).click();
    await expect(row('Antonyms:').getByRole('link', { name: 'blacken' })).toBeVisible();

    // unlink the synonym from its tag
    await row('Synonyms:').locator('.ant-tag-close-icon').click();
    await expect(row('Synonyms:').getByRole('link', { name: 'twinkle' })).toBeHidden();

    const word = await getWord(request, id);
    expect(word.meanings[0].synonyms).toEqual([]);
    expect(word.meanings[0].antonyms).toEqual(['blacken']);
  });

  test('edits a word form through the card modal and persists it', async ({ page, request }) => {
    const id = await seedWord(request, 'drift');

    await page.goto(`/en/managing/edit-word/${id}`);
    await page.getByText('Past simple:').locator('..').getByRole('button', { name: 'edit' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Editing Word Form')).toBeVisible();
    await dialog.getByPlaceholder('Word', { exact: true }).fill('drifted-edited');
    await dialog.getByPlaceholder('Pronunciation').fill('ˈdrɪftɪd');
    await dialog.getByRole('button', { name: 'OK' }).click();

    // Editing a form shows no toast — the modal closes and the tag updates
    await expect(dialog).toBeHidden();
    await expect(page.getByText('drifted-edited', { exact: true })).toBeVisible();

    const word = await getWord(request, id);
    expect(word.forms).toEqual([
      expect.objectContaining({
        word: 'drifted-edited',
        form_of_word: 'past_simple',
        transcription: 'ˈdrɪftɪd',
      }),
    ]);
  });

  test('deletes a word form through the confirmation modal', async ({ page, request }) => {
    // The seed helper derives the past-simple form as `word + 'ed'`, so the
    // base word must not end in 'e' for the form to read naturally
    const id = await seedWord(request, 'ascend');

    await page.goto(`/en/managing/edit-word/${id}`);
    await expect(page.getByText('ascended', { exact: true })).toBeVisible();
    await page.getByText('Past simple:').locator('..').getByRole('button', { name: 'close' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText('Word form deleted successfully')).toBeVisible();
    await expect(page.getByText('ascended', { exact: true })).toBeHidden();

    const word = await getWord(request, id);
    expect(word.forms).toEqual([]);
  });

  test('cancelling the common-data modal keeps the word unchanged', async ({ page, request }) => {
    const id = await seedWord(request, 'endure');

    await page.goto(`/en/managing/edit-word/${id}`);
    await page.getByRole('button', { name: 'Edit Common Data' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Word Description').fill('this edit must never be saved');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).toBeHidden();
    const main = page.getByRole('main');
    await expect(main.getByText('to endure fast')).toBeVisible();
    await expect(main.getByText('this edit must never be saved')).toBeHidden();

    const word = await getWord(request, id);
    expect(word.description).toBe('to endure fast');
  });
});
