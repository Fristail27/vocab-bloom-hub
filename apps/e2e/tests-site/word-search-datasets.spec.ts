import { expect, test } from '@playwright/test';

const terms = (dataset: string, title: string) => ({
  dataset,
  title,
  attribution: `${title} authors`,
  license: 'CC0-1.0',
});
const choices = [
  terms('default', 'First dictionary'),
  terms('wordnet', 'WordNet'),
  ...['aa', 'bb', 'cc', 'dd'].map((name) => terms(name, name)),
];
const group = (dataset: string, page = 1) => ({
  ...choices.find((d) => d.dataset === dataset),
  status: 'ok',
  data: [{ id: 1, word: page === 1 ? 'run' : 'running', part_of_speech: 'noun' }],
  meta: { page, limit: 20, has_more: page === 1, fuzzy: false, short_term: false },
});

test('selector preserves query and repeated names across reload and locale changes, and pages one group', async ({
  page,
}) => {
  await page.route('**/api/v1/datasets', (route) =>
    route.fulfill({ json: { data: choices, meta: { max_search_datasets: 5 } } }),
  );
  const calls: URL[] = [];
  await page.route('**/api/v1/search/datasets?**', (route) => {
    const url = new URL(route.request().url());
    calls.push(url);
    return route.fulfill({
      json: {
        data: url.searchParams
          .getAll('datasets')
          .map((name) => group(name, Number(url.searchParams.get('page') ?? 1))),
        meta: { datasets: url.searchParams.getAll('datasets').length, partial: false },
      },
    });
  });
  await page.goto('/en/word');
  await page.getByRole('searchbox').fill('run');
  await page.locator('summary').filter({ hasText: 'Dictionaries' }).click();
  await page.getByRole('checkbox', { name: 'First dictionary', exact: true }).check();
  await page.getByRole('checkbox', { name: 'WordNet', exact: true }).check();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('2 results shown.');
  const first = page.getByRole('region', { name: 'First dictionary', exact: true });
  const second = page.getByRole('region', { name: 'WordNet', exact: true });
  await expect(second.getByRole('link', { name: 'run', exact: true })).toHaveAttribute(
    'href',
    '/en/word/run?dataset=wordnet',
  );
  await second.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(second.getByRole('link', { name: 'running', exact: true })).toBeVisible();
  await expect(first.getByRole('link', { name: 'run', exact: true })).toBeVisible();
  expect(calls.at(-1)!.searchParams.getAll('datasets')).toEqual(['wordnet']);
  expect(calls.at(-1)!.searchParams.get('page')).toBe('2');
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('2 results shown.');
  await page.getByRole('link', { name: 'ar', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('status')).toHaveText('تُعرض نتيجتان.');
  const url = new URL(page.url());
  expect(url.searchParams.get('q')).toBe('run');
  expect(url.searchParams.getAll('datasets')).toEqual(['default', 'wordnet']);
  await expect(
    page.getByRole('region', { name: 'WordNet', exact: true }).getByRole('link', { name: 'run', exact: true }),
  ).toHaveAttribute('href', '/ar/word/run?dataset=wordnet');
});

test('selector bounds selection, and partial/closed targets never display fallback results', async ({
  page,
}) => {
  await page.route('**/api/v1/datasets', (route) =>
    route.fulfill({ json: { data: choices, meta: { max_search_datasets: 5 } } }),
  );
  await page.route('**/api/v1/search/datasets?**', (route) =>
    route.fulfill({
      json: {
        data: [
          group('default'),
          { ...terms('wordnet', 'WordNet'), status: 'unavailable', error: 'dataset_unavailable' },
        ],
        meta: { datasets: 2, partial: true },
      },
    }),
  );
  await page.goto('/en/word?q=run&datasets=default&datasets=wordnet');
  await expect(page.getByRole('status')).toContainText('Some dictionaries could not be searched.');
  const second = page.getByRole('region', { name: 'WordNet', exact: true });
  await expect(second).toContainText('This dictionary could not be searched.');
  await expect(second.getByRole('link')).toHaveCount(0);
  await page.locator('summary').filter({ hasText: 'Dictionaries' }).click();
  for (const name of ['aa', 'bb', 'cc']) await page.getByRole('checkbox', { name, exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'dd', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Active dictionary (default)', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'dd', exact: true })).toBeEnabled();
  await page.route('**/api/v1/search?**', (route) =>
    route.fulfill({ status: 404, json: { error: true, message: 'dataset_not_found' } }),
  );
  await page.goto('/en/word?q=run&dataset=closed');
  await expect(page.getByRole('status')).toHaveText('The dictionary did not answer.');
  await expect(
    page.getByRole('search').locator('..').getByRole('link', { name: 'run', exact: true }),
  ).toHaveCount(0);
});
