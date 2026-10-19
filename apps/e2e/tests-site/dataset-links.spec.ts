import { expect, test } from '@playwright/test';

import { SITE_STUB_URL } from '../config';

test('a direct dataset link survives reload and serves matching metadata', async ({ page }) => {
  await page.goto('/en/word/run?dataset=wordnet&ref=share');
  await expect(page.getByRole('tab', { name: 'Open English WordNet' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('definition of a race run on foot')).toBeVisible();
  await expect(page.getByText('/second/').first()).toBeVisible();
  await expect(page.getByText('definition of to move fast')).toHaveCount(0);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'definition of a race run on foot',
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    'definition of a race run on foot',
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    /\/en\/word\/run\?dataset=wordnet$/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/word\/run$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Open English WordNet' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('definition of a race run on foot')).toBeVisible();
});

test('tabs preserve parameters, Back/Forward, and locale changes', async ({ page }) => {
  await page.goto('/en/word/run?ref=share&ref=again');
  const own = page.getByRole('tab', { name: 'Vocab Bloom Hub English dataset' });
  const other = page.getByRole('tab', { name: 'Open English WordNet' });
  await other.click();
  await expect(page).toHaveURL(/\?ref=share&ref=again&dataset=wordnet$/);
  await expect(other).toBeFocused();
  await page.goBack();
  await expect(own).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('definition of to move fast')).toBeVisible();
  await page.goForward();
  await expect(other).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('definition of a race run on foot')).toBeVisible();
  await page.locator('header').getByRole('link', { name: 'ru', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/word\/run\?ref=share&ref=again&dataset=wordnet$/);
  await expect(other).toHaveAttribute('aria-selected', 'true');
  // The selected dataset has no Russian translations, unlike the default one.
  await expect(page).not.toHaveTitle(/бежать/);
  await page.locator('header').getByRole('link', { name: 'ar', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await other.focus();
  await other.press('ArrowRight');
  await expect(own).toBeFocused();
  await expect(own).toHaveAttribute('aria-selected', 'true');
  await own.press('End');
  await expect(other).toBeFocused();
  await expect(other).toHaveAttribute('aria-selected', 'true');
  await other.press('Home');
  await expect(own).toBeFocused();
  await expect(own).toHaveAttribute('aria-selected', 'true');
});

test('normalizing case retains the selector and exact variants stay distinct', async ({ page, request }) => {
  const response = await request.get('/en/word/RUN?dataset=wordnet&ref=share', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe('/en/word/run?dataset=wordnet&ref=share');
  await page.goto('/en/word/Polish?dataset=default');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Polish');
  await expect(page.getByText('the language spoken in Poland').first()).toBeVisible();
  await expect(page.getByTestId('dataset-tabs')).toHaveCount(0);
  const variant = page.getByTestId('other-spellings').getByRole('link', { name: 'polish', exact: true });
  await expect(variant).toHaveAttribute('href', '/en/word/polish?dataset=default');
  await variant.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('polish');
  await expect(page.getByText('to make smooth and shiny').first()).toBeVisible();
  await expect(page.getByText('the language spoken in Poland')).toHaveCount(0);
});

for (const query of ['dataset=unknown', 'dataset=', 'dataset=wordnet&dataset=default']) {
  test(`an invalid selector is explicit: ${query}`, async ({ page }) => {
    await page.goto(`/en/word/run?${query}&ref=share`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dataset entry unavailable');
    await expect(page.getByRole('status').filter({ hasText: 'This dataset is unavailable' })).toContainText(
      'unavailable or does not contain this word',
    );
    await expect(page.getByText('definition of to move fast')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const fallback = page.getByRole('link', { name: 'Open the normal word page' });
    await expect(fallback).toHaveAttribute('href', '/en/word/run?ref=share');
    await fallback.click();
    await expect(page.getByText('definition of to move fast')).toBeVisible();
  });
}

test('a closed dataset cannot be opened by an old link', async ({ page, request }) => {
  const control = `${SITE_STUB_URL}/__test__/dataset-visibility`;
  await page.goto('/en/word/run?dataset=wordnet');
  await expect(page.getByText('definition of a race run on foot')).toBeVisible();
  try {
    await request.post(control, { data: false });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dataset entry unavailable');
    await expect(page.getByText('definition of a race run on foot')).toHaveCount(0);
    await expect(page.getByText('Open English WordNet')).toHaveCount(0);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /This dataset is unavailable/,
    );
  } finally {
    await request.post(control, { data: true });
  }
});

test('single-tab links work and words absent from the active dataset stay noindex', async ({ page }) => {
  await page.goto('/en/word/abandon?dataset=default');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('abandon');
  await expect(page.getByTestId('dataset-tabs')).toHaveCount(0);
  await page.goto('/en/word/abandon?dataset=wordnet');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dataset entry unavailable');
  for (const suffix of ['', '?dataset=wordnet']) {
    await page.goto(`/en/word/footrace${suffix}`);
    await expect(page.getByText('definition of a race between people who run')).toBeVisible();
    await expect(page.getByTestId('dataset-tabs')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
});
