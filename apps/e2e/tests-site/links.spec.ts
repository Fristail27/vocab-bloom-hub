import { expect, test } from '@playwright/test';

// A crawler over the rendered documentation (issue #330): starting from the
// docs index it follows every /en/docs link, so a page added to the site
// registry is covered without editing this test. Every internal href must
// answer 200 and every #anchor must exist on its target page — this is what
// keeps the Markdown link rewriting (apps/site/src/content/links.ts) and the
// rehype-slug heading ids honest.
test('every internal link and anchor of the documentation resolves', async ({ page, request }) => {
  test.setTimeout(240_000);

  const toVisit = ['/en/docs'];
  const visited = new Set<string>();
  // hash → the pages that must carry the id, with the page that linked it
  const anchorRefs: Array<{ target: string; hash: string; from: string }> = [];
  const checkedStatuses = new Set<string>();
  const failures: string[] = [];

  while (toVisit.length > 0) {
    const path = toVisit.pop() as string;
    if (visited.has(path)) continue;
    visited.add(path);

    const response = await page.goto(path);
    expect(response?.status(), `crawling ${path}`).toBe(200);

    const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    for (const href of hrefs) {
      // same-page anchor
      if (href.startsWith('#')) {
        anchorRefs.push({ target: path, hash: href.slice(1), from: path });
        continue;
      }
      // external links (GitHub, HuggingFace, …) are out of scope
      if (!href.startsWith('/')) continue;

      const [beforeHash, hash] = href.split('#');
      const target = (beforeHash as string).split('?')[0] as string;
      if (hash) anchorRefs.push({ target, hash, from: path });

      if (target.startsWith('/en/docs')) {
        // another docs page: crawl it too
        if (!visited.has(target)) toVisit.push(target);
      } else if (!checkedStatuses.has(target)) {
        // any other internal page: its status is enough
        checkedStatuses.add(target);
        const res = await request.get(target);
        if (res.status() !== 200) {
          failures.push(`${target} answers ${res.status()} (linked from ${path})`);
        }
      }
    }
  }
  expect(visited.size, 'the crawl found the docs pages').toBeGreaterThan(10);

  // second pass: load every anchor target once and assert the ids exist;
  // hrefs are percent-encoded (e.g. the emoji headings of the README), the
  // DOM ids are the raw characters
  const decode = (hash: string): string => {
    try {
      return decodeURIComponent(hash);
    } catch {
      return hash;
    }
  };
  const hashesByTarget = new Map<string, Map<string, string>>();
  for (const { target, hash, from } of anchorRefs) {
    if (!hashesByTarget.has(target)) hashesByTarget.set(target, new Map());
    hashesByTarget.get(target)?.set(decode(hash), from);
  }
  for (const [target, hashes] of hashesByTarget) {
    await page.goto(target);
    for (const [hash, from] of hashes) {
      const count = await page.locator(`[id="${hash}"]`).count();
      if (count === 0) failures.push(`#${hash} is missing on ${target} (linked from ${from})`);
    }
  }

  expect(failures, failures.join('\n')).toEqual([]);
});
