import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { seedWord } from '../helpers/seed';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

// The client-side fan-out tool (issue #353): rows come from our API, one POST
// per row goes to the external URL from the browser, the mapped answers are
// downloaded as a jsonl file. The external endpoint is stubbed with a route.
test.describe('bulk request', () => {
  test('runs one request per selected row and downloads the mapped results', async ({ page, request }) => {
    await seedWord(request, 'traverse');

    // the default DeepSeek URL, answered locally — including the CORS
    // preflight the JSON content type triggers
    await page.route('https://api.deepseek.com/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      return route.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ choices: [{ message: { content: '{"quality":"ok"}' } }] }),
      });
    });

    await page.goto('/en/managing/bulk-request');

    await page.getByTestId('bulk-api-key').fill('e2e-test-key');
    await page.getByTestId('bulk-next').click();

    // pick exactly our row and run the selected scope
    const row = page.getByRole('row').filter({ hasText: 'traverse' });
    await row.getByRole('checkbox').check();
    await page.getByRole('radio', { name: /Selected rows \(1\)/ }).check();
    await page.getByTestId('bulk-start').click();

    await expect(page.getByTestId('bulk-status')).toHaveText('Done: 1 / 1 — ok 1, failed 0', {
      timeout: 30_000,
    });

    const downloading = page.waitForEvent('download');
    await page.getByTestId('bulk-download-results').click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('vocab-bloom-hub-bulk-request-results.jsonl');

    const line = readFileSync(await download.path(), 'utf8').trim();
    expect(line).toContain('"word":"traverse"');
    expect(line).toContain('"quality":"ok"');
  });
});
