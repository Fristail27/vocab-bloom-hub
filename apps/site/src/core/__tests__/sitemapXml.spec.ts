import { localizedUrls, sitemapIndexXml, urlsetXml } from '../sitemapXml';

describe('the word sitemap XML (issue #480)', () => {
  const date = new Date('2026-09-01T10:00:00Z');

  it('lists a headword once per locale, each with the whole hreflang set and the date', () => {
    const xml = localizedUrls('/word/give%20up', date);

    expect(xml.match(/<url>/g)).toHaveLength(8);
    expect(xml).toContain('<loc>http://localhost:3020/ru/word/give%20up</loc>');
    // nine links per URL: eight locales and x-default
    const first = xml.slice(0, xml.indexOf('</url>'));
    expect(first.match(/<xhtml:link /g)).toHaveLength(9);
    expect(first).toContain('hreflang="x-default" href="http://localhost:3020/en/word/give%20up"');
    expect(first).toContain('<lastmod>2026-09-01T10:00:00.000Z</lastmod>');
  });

  it('escapes the XML characters and omits lastmod without a date', () => {
    const xml = urlsetXml(["/word/rock%20'n'%20roll", '/word/a&b'], null);
    expect(xml).toContain('<loc>http://localhost:3020/en/word/a&amp;b</loc>');
    expect(xml).not.toContain('<lastmod>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns=')).toBe(true);
  });

  it('builds a sitemap index', () => {
    const xml = sitemapIndexXml(['http://localhost:3020/sitemap-words/0.xml'], date);
    expect(xml).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>http://localhost:3020/sitemap-words/0.xml</loc><lastmod>2026-09-01T10:00:00.000Z</lastmod></sitemap></sitemapindex>',
    );
  });
});
