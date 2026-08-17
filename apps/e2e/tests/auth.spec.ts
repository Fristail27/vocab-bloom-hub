import { expect, test } from '@playwright/test';

import { API_URL, E2E_PASSWORD, E2E_USERNAME } from '../config';

// These tests exercise the auth flow itself, so they run without the saved session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('authentication', () => {
  test('redirects an unauthenticated visitor from a protected page to login', async ({ page }) => {
    await page.goto('/en/managing');
    await page.waitForURL('**/en/login');
    await expect(page.getByRole('heading', { name: 'Admin Panel Sign In' })).toBeVisible();
  });

  test('rejects API requests without a token', async ({ request }) => {
    const res = await request.get(`${API_URL}/en/check-word/run?partOfSpeech=verb`);
    expect(res.status()).toBe(401);
  });

  test('shows an error for wrong credentials and stays on the login page', async ({ page }) => {
    await page.goto('/en/login');
    await page.locator('#username').fill('wrong-user');
    await page.locator('#password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Login or password is wrong')).toBeVisible();
    expect(page.url()).toContain('/en/login');
  });

  test('logs in with valid credentials and lands on the dashboard', async ({ page }) => {
    await page.goto('/en/login');
    await page.locator('#username').fill(E2E_USERNAME);
    await page.locator('#password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL('**/en');
    await expect(page.getByRole('heading', { name: 'Main' })).toBeVisible();
  });
});
