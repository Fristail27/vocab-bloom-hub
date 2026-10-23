import { expect, test } from '@playwright/test';

const result = {
  data: [
    {
      word: { word: 'ornithologist', part_of_speech: 'noun' },
      meaning: {
        id: 1,
        title: 'bird scientist',
        definition: 'A scientist who studies birds.',
        modified: false,
      },
      score: 0.9,
    },
  ],
  meta: { dataset: { dataset: 'wordnet', title: 'WordNet', attribution: 'Fixture author', license: 'CC0' } },
};

test('meaning mode uses only the semantic endpoint, shows the matching sense, and never falls back on failure', async ({
  page,
}) => {
  let lexical = 0;
  let fail = false;
  await page.route('**/api/v1/search/semantic/status', (route) =>
    route.fulfill({ json: { data: { enabled: true } } }),
  );
  await page.route('**/api/v1/search?**', async (route) => {
    lexical++;
    await route.fulfill({ json: { data: [], meta: { fuzzy: false } } });
  });
  await page.route('**/api/v1/search/semantic?**', (route) =>
    route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: true } : result }),
  );
  await page.goto('/en/word');
  await page.getByRole('radio', { name: 'By meaning', exact: true }).check();
  const input = page.getByRole('searchbox', { name: 'Describe a meaning' });
  await input.fill('A person who studies birds');
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: 'Closest meanings' })).toBeVisible();
  await expect(page.getByText('A scientist who studies birds.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ornithologist', exact: true })).toHaveAttribute(
    'href',
    '/en/word/ornithologist?dataset=wordnet',
  );
  await expect(input).toBeFocused();
  expect(lexical).toBe(0);
  await expect(page).toHaveURL(/mode=meaning/);
  fail = true;
  await input.press('Enter');
  await expect(page.getByRole('status')).toContainText('Meaning search is unavailable');
  expect(lexical).toBe(0);
  await page.getByRole('radio', { name: 'By spelling', exact: true }).check();
  await page.getByRole('searchbox').press('Enter');
  await expect.poll(() => lexical).toBe(1);
});

test('disabled meaning search stays hidden, including on a restored semantic URL', async ({ page }) => {
  await page.route('**/api/v1/search/semantic/status', (route) =>
    route.fulfill({ json: { data: { enabled: false } } }),
  );
  await page.goto('/en/word?mode=meaning&q=birds');
  await expect(page.getByRole('radio', { name: 'By meaning', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Meaning search is unavailable');
});

test('Arabic meaning mode remains readable at mobile width with RTL', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.route('**/api/v1/search/semantic/status', (route) =>
    route.fulfill({ json: { data: { enabled: true } } }),
  );
  await page.route('**/api/v1/search/semantic?**', (route) => route.fulfill({ json: result }));
  await page.goto('/ar/word?mode=meaning&q=birds&dataset=wordnet');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('radio', { name: 'حسب المعنى', exact: true })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'معانٍ قريبة', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ornithologist', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
