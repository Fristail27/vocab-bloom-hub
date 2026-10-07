import { expect, test } from '@playwright/test';
import type { components } from '../../../packages/npm-sdk/src/generated/openapi';

import { SITE_API_URL } from '../config';

type PublicHeadwordV1ResT = components['schemas']['PublicHeadwordV1ResT'];
type PublicWordDatasetsV1ResT = components['schemas']['PublicWordDatasetsV1ResT'];

// Keep neighbor reads at the browser boundary: the real fixture still renders
// the root word, while responses prove dataset isolation and the depth limit.
test('loads only a selected direct neighbor, once, from the current dataset', async ({ page, request }) => {
  const response = await request.get(`${SITE_API_URL}/v1/words/run`);
  const root = ((await response.json()) as PublicHeadwordV1ResT).data[0];
  let calls = 0;
  await page.route('**/v1/words/sprint/datasets', async (route) => {
    calls++;
    await route.fulfill({
      json: {
        data: [
          {
            dataset: 'wordnet',
            entries: [
              { ...root, meanings: [{ ...root.meanings[0], synonyms: ['wrong-dataset'], antonyms: [] }] },
            ],
          },
          {
            dataset: 'default',
            entries: [
              {
                ...root,
                word: 'sprint',
                meanings: [{ ...root.meanings[0], synonyms: ['run', 'dash'], antonyms: ['walk'] }],
              },
            ],
          },
        ],
      },
    });
  });
  await page.goto('/en/word/run');
  await expect(page.getByTestId('word-graph')).toHaveCount(0);
  expect(calls).toBe(0);
  await page.getByText('Word connections', { exact: true }).click();
  const graph = page.getByTestId('word-graph');
  await expect(graph.locator('canvas')).toBeVisible();
  expect(calls).toBe(0);
  const canvasBox = await graph.locator('canvas').boundingBox();
  // The single direct neighbor is below the word and its meaning in the vertical view.
  await graph.locator('canvas').click({ position: { x: canvasBox!.width / 2, y: canvasBox!.height * 0.8 } });
  await expect(graph.getByRole('status')).toHaveText('Connections loaded');
  expect(calls).toBe(1);
  await expect(graph.locator('option[value="word:dash"]')).toHaveCount(1);
  await expect(graph.locator('option[value="word:run"]')).toHaveCount(1);
  await expect(graph.locator('option[value="word:wrong-dataset"]')).toHaveCount(0);
  let deeperReads = 0;
  await page.route('**/v1/words/dash/datasets', async (route) => {
    deeperReads++;
    await route.abort();
  });
  await graph.getByLabel('Select a node').selectOption('word:dash');
  await expect(graph.getByRole('button', { name: 'Load connections' })).toHaveCount(0);
  await graph.getByLabel('Select a node').selectOption('word:sprint');
  await expect(graph.getByRole('status')).toHaveText('Connections loaded');
  expect(calls).toBe(1);
  expect(deeperReads).toBe(0);
  await graph.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await graph.getByRole('button', { name: 'Fit graph' }).click();
});

test('keeps the graph after a failed request and retries without switching datasets', async ({ page }) => {
  let calls = 0;
  await page.route('**/v1/words/sprint/datasets', async (route) => {
    calls++;
    await route.fulfill(
      calls === 1 ? { status: 503, json: {} } : { json: { data: [{ dataset: 'wordnet', entries: [] }] } },
    );
  });
  await page.goto('/en/word/run');
  await page.getByText('Word connections', { exact: true }).click();
  const graph = page.getByTestId('word-graph');
  await graph.getByLabel('Select a node').selectOption('word:sprint');
  await expect(graph.getByRole('status')).toContainText('Could not load');
  await expect(graph.locator('canvas')).toBeVisible();
  await graph.getByRole('button', { name: 'Retry' }).click();
  await expect(graph.getByRole('status')).toHaveText('No entry for this part of speech in this dataset');
  expect(calls).toBe(2);
});

test('each dataset has its own graph, including shared nodes and an RTL mobile layout', async ({
  page,
  request,
}, testInfo) => {
  const response = await request.get(`${SITE_API_URL}/v1/words/run/datasets`);
  const original = (await response.json()) as PublicWordDatasetsV1ResT;
  const root = original.data[0].entries[0] as PublicHeadwordV1ResT['data'][number];
  const baseMeaning = root.meanings[0];
  await page.route('**/v1/words/run/datasets', async (route) => {
    await route.fulfill({
      json: {
        ...original,
        data: [
          original.data[0],
          {
            ...original.data[0],
            dataset: 'wordnet',
            active: false,
            title: 'Open English WordNet',
            entries: [
              {
                ...root,
                modified: false,
                meanings: [
                  {
                    ...baseMeaning,
                    id: 101,
                    title: 'Move quickly',
                    translations: [
                      {
                        id: 501,
                        language: 'ru',
                        title: 'бежать',
                        definition: 'Быстро передвигаться',
                        variants_of_words: ['бежать', 'мчаться', 'нестись'],
                      },
                      {
                        id: 502,
                        language: 'fr',
                        title: 'courir',
                        definition: 'Se déplacer rapidement',
                        variants_of_words: [],
                      },
                      {
                        id: 503,
                        language: 'ar',
                        title: 'يركض',
                        definition: 'يتحرك بسرعة',
                        variants_of_words: [],
                      },
                    ],
                    definition: 'Move quickly on foot.',
                    synonyms: ['sprint', 'race', 'dash'],
                    antonyms: ['walk'],
                  },
                  {
                    ...baseMeaning,
                    id: 102,
                    title: 'Compete',
                    translations: [
                      {
                        id: 504,
                        language: 'ru',
                        title: 'бежать',
                        definition: 'Участвовать в забеге',
                        variants_of_words: [],
                      },
                      {
                        id: 505,
                        language: 'ru',
                        title: 'соревноваться',
                        definition: '',
                        variants_of_words: [],
                      },
                    ],
                    definition: 'Take part in a race.',
                    synonyms: ['race', 'compete'],
                    antonyms: ['withdraw'],
                  },
                  {
                    ...baseMeaning,
                    id: 103,
                    title: 'Operate',
                    definition: 'Keep something in operation.',
                    synonyms: ['operate', 'manage'],
                    antonyms: ['stop'],
                  },
                ],
              },
              {
                ...root,
                id: 300,
                part_of_speech: 'noun',
                modified: false,
                meanings: [
                  {
                    ...baseMeaning,
                    id: 301,
                    title: 'A series',
                    translations: [],
                    synonyms: ['sequence'],
                    antonyms: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
  });
  await page.route('**/v1/words/race/datasets', async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            dataset: 'wordnet',
            entries: [
              {
                ...root,
                part_of_speech: 'noun',
                word: 'race',
                meanings: [
                  { ...baseMeaning, id: 401, title: 'A contest', synonyms: ['tournament'], antonyms: [] },
                ],
              },
              {
                ...root,
                word: 'race',
                meanings: [
                  {
                    ...baseMeaning,
                    id: 201,
                    title: 'Go at speed',
                    synonyms: ['run', 'dash', 'hurry'],
                    antonyms: ['wait'],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
  });
  await page.goto('/en/word/run');
  await page.getByRole('tab', { name: 'Open English WordNet' }).click();
  await page
    .getByRole('tabpanel', { name: 'Open English WordNet' })
    .getByText('Word connections', { exact: true })
    .click();
  const graph = page.getByTestId('word-graph');
  await expect(graph).toHaveAttribute('data-dataset', 'wordnet');
  await expect(graph).toHaveAttribute('data-part-of-speech', 'verb');
  await expect(graph.locator('option[value="word:sequence"]')).toHaveCount(0);
  await expect(graph.locator('option[value="word:race"]')).toHaveCount(1);
  await graph.getByLabel('Select a node').selectOption('word:race');
  await expect(graph.getByRole('status')).toHaveText('Connections loaded');
  await expect(graph.locator('option[value="word:tournament"]')).toHaveCount(0);
  await graph.getByLabel('Select a node').selectOption('');
  await graph
    .locator('xpath=ancestor::details[1]')
    .screenshot({ path: testInfo.outputPath('graph-desktop.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await graph.screenshot({ path: testInfo.outputPath('graph-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page
    .getByRole('tablist', { name: 'Graph view' })
    .getByRole('tab', { name: 'Translations by meaning' })
    .click();
  await page
    .getByRole('tabpanel', { name: 'Open English WordNet' })
    .getByRole('button', { name: 'ru', exact: true })
    .click();
  await expect(page.getByLabel('Translation language', { exact: true })).toHaveCount(0);
  await expect(graph.getByRole('option', { name: 'мчаться', exact: true })).toHaveCount(1);
  await expect(graph.getByRole('option', { name: 'нестись', exact: true })).toHaveCount(1);
  const modes = page.getByRole('tablist', { name: 'Graph view' });
  await modes.getByRole('tab', { name: 'Translations by meaning' }).focus();
  await page.keyboard.press('Home');
  await expect(modes.getByRole('tab', { name: 'Synonyms and antonyms' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('ArrowRight');
  await expect(modes.getByRole('tab', { name: 'Translations by meaning' })).toBeFocused();
  await expect(modes.getByRole('tab', { name: 'Translations by meaning' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const translated = JSON.stringify(['translation', 'ru', 'бежать']);
  await expect(graph.getByRole('option', { name: 'бежать', exact: true })).toHaveCount(1);
  await graph.getByLabel('Select a node').selectOption(translated);
  await expect(graph).toContainText('Быстро передвигаться');
  await expect(graph).toContainText('Участвовать в забеге');
  await expect(graph.getByRole('link', { name: 'Open word page' })).toHaveCount(0);
  await expect(graph.getByRole('button', { name: 'Load connections' })).toHaveCount(0);
  await graph.getByLabel('Select a node').selectOption('');
  await graph.screenshot({ path: testInfo.outputPath('translations.png') });
  await page
    .getByRole('tabpanel', { name: 'Open English WordNet' })
    .getByRole('button', { name: 'ar', exact: true })
    .click();
  await expect(graph.getByRole('option', { name: 'يركض', exact: true })).toHaveCount(1);
  await expect(graph.getByRole('option', { name: 'бежать', exact: true })).toHaveCount(0);
  await page.emulateMedia({ colorScheme: 'dark' });
  await graph.screenshot({ path: testInfo.outputPath('translations-ar-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  const parts = page.getByRole('tablist', { name: 'Part of speech' });
  await parts.getByRole('tab', { name: 'verb', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(parts.getByRole('tab', { name: 'noun', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(graph).toHaveAttribute('data-part-of-speech', 'noun');
  await page
    .getByRole('tablist', { name: 'Graph view' })
    .getByRole('tab', { name: 'Translations by meaning' })
    .click();
  await expect(graph).toContainText(
    'No translations for the selected language and part of speech in this dataset.',
  );
  await expect(page.getByLabel('Translation language', { exact: true })).toHaveCount(0);
  await page
    .getByRole('tablist', { name: 'Graph view' })
    .getByRole('tab', { name: 'Synonyms and antonyms' })
    .click();
  await expect(graph.locator('option[value="word:sequence"]')).toHaveCount(1);
  await expect(graph.locator('option[value="word:race"]')).toHaveCount(0);
  await expect(graph.locator('option[value="word:hurry"]')).toHaveCount(0);
  await parts.getByRole('tab', { name: 'verb', exact: true }).click();
  await expect(graph).toHaveAttribute('data-part-of-speech', 'verb');
  await expect(graph.getByLabel('Select a node')).toHaveValue('');
  await page.getByRole('tab', { name: 'Vocab Bloom Hub English dataset' }).click();
  await page.getByText('Word connections', { exact: true }).click();
  await expect(page.getByTestId('word-graph')).toHaveAttribute('data-dataset', 'default');
  await expect(page.getByTestId('word-graph').locator('option[value="word:race"]')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ar/word/run');
  await page.getByText('علاقات الكلمة', { exact: true }).click();
  const mobile = page.getByTestId('word-graph');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(mobile.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mobile.screenshot({ path: testInfo.outputPath('graph-mobile.png') });
});

test('closing the graph cancels an in-flight neighbor read', async ({ page }) => {
  await page.route('**/v1/words/sprint/datasets', () => {
    /* Keep the request pending until the graph closes. */
  });
  await page.goto('/en/word/run');
  await page.getByText('Word connections', { exact: true }).click();
  const started = page.waitForRequest('**/v1/words/sprint/datasets');
  const aborted = page.waitForEvent('requestfailed', (request) =>
    request.url().endsWith('/words/sprint/datasets'),
  );
  await page.getByTestId('word-graph').getByLabel('Select a node').selectOption('word:sprint');
  await started;
  await expect(page.getByTestId('word-graph').getByRole('status')).toHaveText('Loading…');
  await page.getByText('Word connections', { exact: true }).click();
  await aborted;
  await expect(page.getByTestId('word-graph')).toHaveCount(0);
  await page.getByText('Word connections', { exact: true }).click();
  await expect(page.getByTestId('word-graph').getByLabel('Select a node')).toHaveValue('');
});
