import { expect, test } from '@playwright/test';

import { createJwt } from '../../server/core/utils/auth';
import { hashLoginString } from '../../server/core/utils/crypto';
import { E2E_PASSWORD, E2E_USERNAME, SITE_API_URL } from '../config';

test('dataset links read real isolated PostgreSQL datasets, history and visibility', async ({
  page,
  request,
}) => {
  test.skip(!process.env.SITE_E2E_POSTGRES_URL, 'Run with playwright.site-postgres.config.ts');
  const hash = await hashLoginString(E2E_USERNAME, E2E_PASSWORD);
  const secret = await hashLoginString(E2E_USERNAME, hash);
  const headers = { Authorization: `Bearer ${createJwt({ role: 'admin' }, secret + hash)}` };
  const name = 'shared_links';
  const word = 'linkfixture';
  const createWord = async (dataset: string, description: string) => {
    const response = await request.post(`${SITE_API_URL}/en/add/word?dataset=${dataset}`, {
      headers,
      data: {
        word,
        description,
        transcription: dataset === 'default' ? '/first/' : '/selected/',
        part_of_speech: 'noun',
        form_of_word: 'base_form',
        area_variant: 'common',
        meanings: [],
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).id as number;
  };
  const created = await request.post(`${SITE_API_URL}/en/datasets`, {
    headers,
    data: {
      name,
      title: 'Shared links fixture',
      license: { spdx: 'CC0-1.0' },
      attribution: 'Dataset link fixture authors',
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const activeId = await createWord('default', 'The active dataset definition.');
  try {
    const id = await createWord(name, 'Before the selected edit.');
    const edited = await request.patch(`${SITE_API_URL}/en/common-info/${id}?dataset=${name}`, {
      headers,
      data: { description: 'The selected dataset definition.' },
    });
    expect(edited.ok(), await edited.text()).toBe(true);
    const visibility = async (is_public: boolean) => {
      const response = await request.patch(`${SITE_API_URL}/en/datasets/${name}/visibility`, {
        headers,
        data: { is_public },
      });
      expect(response.ok(), await response.text()).toBe(true);
    };
    await visibility(true);
    // Discovery through real selected/grouped search keeps the origin in every link (#652).
    await page.goto(`/en/word?q=${word}&dataset=${name}`);
    await expect(page.getByRole('status')).toHaveText('1 result shown.');
    const found = page.getByRole('link', { name: word, exact: true });
    await expect(found).toHaveAttribute('href', `/en/word/${word}?dataset=${name}`);
    await found.click();
    await expect(page.getByRole('tab', { name: 'Shared links fixture' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goto(`/en/word?q=${word}&datasets=default&datasets=${name}`);
    await expect(page.getByRole('status')).toHaveText('2 results shown.');
    await expect(
      page.getByRole('region', { name: 'Shared links fixture' }).getByRole('link', { name: word, exact: true }),
    ).toHaveAttribute('href', `/en/word/${word}?dataset=${name}`);
    await expect(
      page
        .getByRole('region', { name: 'Vocab Bloom Hub English dataset' })
        .getByRole('link', { name: word, exact: true }),
    ).toHaveAttribute('href', `/en/word/${word}?dataset=default`);
    const link = `/en/word/${word}?dataset=${name}`;
    // Check the response before JavaScript can select or fetch another panel.
    const rendered = await request.get(link);
    const html = await rendered.text();
    expect(rendered.status()).toBe(200);
    expect(html).toContain('The selected dataset definition.');
    expect(html).toContain('Before the selected edit.');
    expect(html).toContain('Dataset link fixture authors');
    expect(html).toContain('/selected/');
    expect(html).not.toContain('The active dataset definition.');
    expect(html).not.toContain('/first/');
    await page.goto(link);
    await expect(page.getByRole('tab', { name: 'Shared links fixture' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'The selected dataset definition.',
    );
    const history = page.getByTestId('word-history');
    await history.locator('summary').click();
    await expect(history.locator('del')).toHaveText('Before the selected edit.');
    await expect(history.locator('ins')).toHaveText('The selected dataset definition.');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Shared links fixture' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: 'Vocab Bloom Hub English dataset' }).click();
    await expect(page.getByText('The active dataset definition.')).toBeVisible();
    await page.goBack();
    await expect(page.getByText('The selected dataset definition.').first()).toBeVisible();
    // The form sends the actual inactive dataset and its local entry IDs (#651).
    await page.getByRole('button', { name: 'Report a mistake' }).click();
    let form = page.getByRole('form', { name: 'Report a mistake' });
    await expect(form).toContainText('Dataset: Shared links fixture');
    await expect(form).toContainText('CC0');
    await form.getByRole('button', { name: 'Edit the entry' }).click();
    await form.getByLabel('Description').fill('A reader correction for the selected dataset.');
    const sent = page.waitForRequest((req) => req.url().endsWith('/v1/suggestions') && req.method() === 'POST');
    await form.getByRole('button', { name: 'Suggest the changes' }).click();
    expect((await sent).postDataJSON()).toMatchObject({
      dataset: name,
      headword: word,
      edits: [{ target_type: 'word', target_id: id }],
    });
    await expect(page.getByText('Thank you — the proposal is in the moderation queue.')).toBeVisible();
    const queue = await request.get(`${SITE_API_URL}/en/suggestions?dataset=${name}`, { headers });
    expect(await queue.text()).toContain('A reader correction for the selected dataset.');
    const activeQueue = await request.get(`${SITE_API_URL}/en/suggestions?dataset=default`, { headers });
    expect(await activeQueue.text()).not.toContain('A reader correction for the selected dataset.');
    await page.reload();
    await page.getByRole('button', { name: 'Report a mistake' }).click();
    form = page.getByRole('form', { name: 'Report a mistake' });
    await form.getByRole('textbox', { name: 'What is wrong' }).fill('A report from an already opened page.');
    await visibility(false);
    await form.getByRole('button', { name: 'Send the report' }).click();
    await expect(form).toContainText('This dataset or entry is no longer available for reports.');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dataset entry unavailable');
    await expect(page.getByText('Shared links fixture')).toHaveCount(0);
    await expect(page.getByText('The selected dataset definition.')).toHaveCount(0);
    await visibility(true);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Shared links fixture' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const removed = await request.delete(`${SITE_API_URL}/en/datasets/${name}`, { headers });
    expect(removed.ok(), await removed.text()).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dataset entry unavailable');
  } finally {
    await request.delete(`${SITE_API_URL}/en/datasets/${name}`, { headers });
    await request.delete(`${SITE_API_URL}/en/${activeId}?dataset=default`, { headers });
  }
});
