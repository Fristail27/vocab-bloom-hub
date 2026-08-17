import { test as setup } from '@playwright/test';

import { E2E_PASSWORD, E2E_USERNAME, STORAGE_STATE } from '../config';

// Real UI login: the server sets the httpOnly bearer cookie, the saved
// storageState carries it into every authenticated test project
setup('log in through the UI and save the session', async ({ page }) => {
  await page.goto('/en/login');
  await page.locator('#username').fill(E2E_USERNAME);
  await page.locator('#password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/en');
  await page.context().storageState({ path: STORAGE_STATE });
});
