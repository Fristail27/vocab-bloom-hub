import { test as setup } from '@playwright/test';

// Pure helpers from the server workspace (node:crypto + jsonwebtoken):
// the same Bearer derivation the server test suites use. The admin suite
// logs in through the UI instead; the site stack has no admin UI to do so.
import { hashLoginString } from '../../server/core/utils/crypto';
import { createJwt } from '../../server/core/utils/auth';
import { E2E_PASSWORD, E2E_USERNAME, SITE_API_URL } from '../config';
import { FIXTURE_WORDS } from '../helpers/site-fixture';

// Seeds the dictionary the website renders (issue #330). The words mirror
// apps/server/test/harness/public-api-fixture.ts, so the site suite and the
// SDK live tests assert the same data.
setup('seed the fixture words through the admin API', async ({ request }) => {
  const hashByEnv = await hashLoginString(E2E_USERNAME, E2E_PASSWORD);
  const secretHash = await hashLoginString(E2E_USERNAME, hashByEnv);
  const token = createJwt({ role: 'admin' }, secretHash + hashByEnv);
  const headers = { Authorization: `Bearer ${token}` };

  for (const word of FIXTURE_WORDS) {
    const res = await request.post(`${SITE_API_URL}/en/add/word`, { data: word, headers });
    if (!res.ok()) {
      throw new Error(
        `Seeding "${(word as { word: string }).word}" failed with ${res.status()}: ${await res.text()}`,
      );
    }
  }
});
