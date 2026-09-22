import { expect, test } from '@playwright/test';

// The SEO last mile (issues #350, #480): canonical/hreflang, one URL per
// page, descriptions of a snippet's length, structured data, the sitemaps,
// the browse index, the caching of the word pages and the styled 404
test.describe('seo', () => {
  test('a word page carries canonical, hreflang, a short description and structured data; the favicon answers', async ({
    page,
    request,
  }) => {
    await page.goto('/en/word/run');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/word\/run$/);
    await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveAttribute(
      'href',
      /\/ru\/word\/run$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      /\/en\/word\/run$/,
    );
    // a search snippet's length, and the English page describes the word by its definition
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toMatch(/to move fast/);
    expect(description?.length).toBeLessThanOrEqual(160);

    // the trail and the term in its licensed dictionary (issue #480)
    const graphs = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) as string,
    );
    expect(graphs.map((graph: { '@type': string }) => graph['@type'])).toEqual([
      'BreadcrumbList',
      'DefinedTerm',
    ]);
    expect(graphs[1]).toMatchObject({
      name: 'run',
      inLanguage: 'en',
      url: 'http://localhost:3021/en/word/run',
      inDefinedTermSet: { '@type': 'DefinedTermSet', license: 'https://creativecommons.org/licenses/by/4.0/' },
    });
    expect(graphs[0].itemListElement[1]).toMatchObject({
      position: 2,
      item: 'http://localhost:3021/en/word/run',
    });

    const icon = await request.get('/icon.svg');
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toContain('svg');
  });

  test('a spelling variant of a headword redirects to the one canonical URL (issue #480)', async ({
    request,
  }) => {
    const response = await request.get('/en/word/Run', { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers()['location']).toMatch(/\/en\/word\/run$/);
  });

  test('an untranslated docs page is canonicalized to the English one and declares only real translations', async ({
    page,
  }) => {
    const response = await page.goto('/de/docs/observability');

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/docs\/observability$/);
    await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveCount(0);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      /\/en\/docs\/observability$/,
    );
    // one hreflang convention: the middleware no longer sends its own Link header
    expect(response?.headers()['link']).toBeUndefined();

    // a translated page keeps its own canonical and lists the languages it exists in
    await page.goto('/ru/docs/environment');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ru\/docs\/environment$/);
    await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(0);
  });

  test('the landing and the docs carry structured data (issue #480)', async ({ page }) => {
    await page.goto('/en');
    const landing = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) as string,
    );
    expect(landing.map((graph: { '@type': string }) => graph['@type'])).toEqual([
      'WebSite',
      'SoftwareSourceCode',
    ]);
    expect(landing[0].potentialAction.target.urlTemplate).toBe(
      'http://localhost:3021/en/word?q={search_term_string}',
    );
    expect(landing[1].codeRepository).toBe('https://github.com/Fristail27/vocab-bloom-hub');

    await page.goto('/de/docs/observability');
    const docs = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) as string);
    expect(docs.map((graph: { '@type': string }) => graph['@type'])).toEqual(['BreadcrumbList', 'TechArticle']);
    // the English file under /de: the article is English, the trail is German
    expect(docs[1]).toMatchObject({ inLanguage: 'en', url: 'http://localhost:3021/de/docs/observability' });
    expect(docs[1].dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(docs[0].itemListElement[0]).toMatchObject({
      name: 'Dokumentation',
      item: 'http://localhost:3021/de/docs',
    });
  });

  test('docs pages describe themselves by their first paragraph', async ({ page }) => {
    await page.goto('/en/docs/api');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toMatch(/^The server exposes two surfaces on one host/);
    expect(description?.length).toBeLessThanOrEqual(160);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      description as string,
    );
  });

  test('the static sitemap carries hreflang and lastmod and lists a docs page only where it is translated', async ({
    request,
  }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();

    expect(sitemap).toContain('<loc>http://localhost:3021/ru/docs/environment</loc>');
    expect(sitemap).not.toContain('<loc>http://localhost:3021/de/docs/observability</loc>');
    expect(sitemap).toContain('<loc>http://localhost:3021/de/docs/getting-started</loc>');
    expect(sitemap).toMatch(
      /<xhtml:link rel="alternate" hreflang="x-default" href="http:\/\/localhost:3021\/en\/docs"/,
    );
    expect(sitemap).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}/);
  });

  test('robots lists both sitemaps; the word sitemap is an index whose chunks walk the dictionary', async ({
    request,
  }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('/sitemap.xml');
    expect(robots).toContain('/sitemap-words.xml');

    const index = await request.get('/sitemap-words.xml');
    expect(index.status()).toBe(200);
    expect(index.headers()['content-type']).toContain('application/xml');
    const indexXml = await index.text();
    expect(indexXml).toContain('<sitemapindex');
    expect(indexXml).toContain('<loc>http://localhost:3021/sitemap-words/0.xml</loc>');

    const chunk = await (await request.get('/sitemap-words/0.xml')).text();
    expect(chunk).toContain('<loc>http://localhost:3021/en/word/run</loc>');
    expect(chunk).toContain('<loc>http://localhost:3021/ru/word/run</loc>');
    expect(chunk).toContain(
      '<xhtml:link rel="alternate" hreflang="ru" href="http://localhost:3021/ru/word/run"/>',
    );
    expect(chunk).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="http://localhost:3021/en/word/run"/>',
    );
    expect(chunk).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/);
    // three fixture words fit one chunk
    expect((await request.get('/sitemap-words/1.xml')).status()).toBe(404);
  });

  test('the browse index pages through every headword by its first letter', async ({ page, request }) => {
    await page.goto('/en/word/browse');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All words');
    // the letter with its count: one fixture headword starts with r
    const letterR = page.locator('a[href="/en/word/browse/r"]');
    await expect(letterR).toContainText('r');
    await expect(letterR.locator('small')).toHaveText('1');
    await letterR.click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Words starting with R');
    await expect(page.getByRole('link', { name: 'run', exact: true })).toHaveAttribute('href', '/en/word/run');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/word\/browse\/r$/);

    // past the end, an unknown letter and a bad page number are 404s, not empty pages
    for (const path of [
      '/en/word/browse/r/2',
      '/en/word/browse/zz',
      '/en/word/browse/r/0',
      '/en/word/browse/r/1/x',
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    // the first page has one URL
    const first = await request.get('/en/word/browse/r/1', { maxRedirects: 0 });
    expect(first.status()).toBe(308);
    expect(first.headers()['location']).toMatch(/\/en\/word\/browse\/r$/);
    // the index and the footer link it
    await page.goto('/en/word');
    await expect(page.getByRole('link', { name: 'Browse all words' })).toHaveAttribute(
      'href',
      '/en/word/browse',
    );
    await expect(page.locator('footer').getByRole('link', { name: 'All words' })).toHaveAttribute(
      'href',
      '/en/word/browse',
    );
  });

  test('word and browse pages are regenerated on demand and cacheable, the random redirect is not', async ({
    request,
  }) => {
    const cacheable = 's-maxage=3600, stale-while-revalidate=86400';
    expect((await request.get('/en/word/run')).headers()['cache-control']).toBe(cacheable);
    expect((await request.get('/en/word/browse')).headers()['cache-control']).toBe(cacheable);
    expect((await request.get('/en/word/browse/r')).headers()['cache-control']).toBe(cacheable);
    // the second request is served from the cache
    expect((await request.get('/en/word/run')).headers()['x-nextjs-cache']).toBe('HIT');
    expect((await request.get('/en/word/random', { maxRedirects: 0 })).headers()['cache-control']).toBe(
      'no-store',
    );
  });

  test('the manifest and the apple icon answer and are linked from every page (issue #480)', async ({
    page,
    request,
  }) => {
    await page.goto('/ru/docs');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /\/manifest\.webmanifest$/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /\/apple-icon/);
    // no verification token was given to this build: no tag, not an empty one
    await expect(page.locator('meta[name="google-site-verification"]')).toHaveCount(0);

    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.status()).toBe(200);
    expect(await manifest.json()).toMatchObject({
      name: 'Vocab Bloom Hub',
      icons: [{ src: '/icon.svg' }, { src: '/apple-icon' }],
    });
    const icon = await request.get('/apple-icon');
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toContain('image/png');
  });

  test('an unmatched URL renders the styled 404, not the framework default', async ({ page }) => {
    const response = await page.goto('/en/dcos');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
    await expect(page.getByRole('link', { name: 'Back to the start page' })).toBeVisible();
  });
});
