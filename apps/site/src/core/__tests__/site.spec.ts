import { localeAlternates, pageMeta, trimDescription } from '../site';

// The metadata every page is built from (issue #480): the whole social card,
// the canonical / hreflang pair and a description that fits a search snippet
describe('pageMeta', () => {
  it('restates the whole social card, og:url included, and the canonical pair', () => {
    const meta = pageMeta({ locale: 'ru', path: '/docs', title: 'Документация', description: 'Всё о проекте' });

    expect(meta.title).toBe('Документация');
    expect(meta.description).toBe('Всё о проекте');
    expect(meta.alternates?.canonical).toBe('/ru/docs');
    expect(meta.openGraph).toEqual({
      type: 'website',
      siteName: 'Vocab Bloom Hub',
      locale: 'ru',
      url: '/ru/docs',
      title: 'Документация',
      description: 'Всё о проекте',
      images: [{ url: '/ru/opengraph-image', width: 1200, height: 630, alt: 'Vocab Bloom Hub' }],
    });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Документация',
      description: 'Всё о проекте',
    });
  });

  it('keeps the home page title out of the template and marks documents as articles', () => {
    expect(pageMeta({ locale: 'en', path: '', title: 'Brand — words', absoluteTitle: true }).title).toEqual({
      absolute: 'Brand — words',
    });
    const article = pageMeta({ locale: 'en', path: '/word/run', title: 'run', type: 'article' });
    expect(article.openGraph).toMatchObject({ type: 'article', url: '/en/word/run' });
  });
});

describe('localeAlternates', () => {
  it('lists every interface language with the English page as x-default', () => {
    const alternates = localeAlternates('de', '/api');

    expect(alternates?.canonical).toBe('/de/api');
    expect(alternates?.languages).toMatchObject({
      en: '/en/api',
      de: '/de/api',
      ar: '/ar/api',
      'x-default': '/en/api',
    });
    expect(Object.keys(alternates?.languages ?? {})).toHaveLength(9);
  });

  it('canonicalizes a locale the page does not exist in to the English URL and declares the real translations only', () => {
    const alternates = localeAlternates('de', '/docs/operations', ['en', 'ru']);

    expect(alternates?.canonical).toBe('/en/docs/operations');
    expect(alternates?.languages).toEqual({
      en: '/en/docs/operations',
      ru: '/ru/docs/operations',
      'x-default': '/en/docs/operations',
    });
    // a locale the page exists in keeps its own canonical
    expect(localeAlternates('ru', '/docs/operations', ['en', 'ru'])?.canonical).toBe('/ru/docs/operations');
  });
});

describe('trimDescription', () => {
  it('leaves a short text alone, collapsing whitespace', () => {
    expect(trimDescription('to move  fast\n on foot')).toBe('to move fast on foot');
  });

  it('cuts a long text at a word boundary under the limit, with an ellipsis', () => {
    const words = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
    const trimmed = trimDescription(words);

    expect(trimmed.length).toBeLessThanOrEqual(160);
    expect(trimmed).toMatch(/^word0 word1 .*word\d+…$/);
    expect(trimmed).not.toMatch(/word\d*…$/.source.replace('word', 'wor'));
  });

  it('drops a dangling separator before the ellipsis', () => {
    const text = `${'a'.repeat(100)} ${'b'.repeat(50)}, ${'c'.repeat(40)}`;
    expect(trimDescription(text)).toBe(`${'a'.repeat(100)} ${'b'.repeat(50)}…`);
  });

  it('cuts a run without spaces hard', () => {
    expect(trimDescription('x'.repeat(200), 20)).toBe(`${'x'.repeat(19)}…`);
  });
});

describe('siteVerification', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('is absent without tokens and maps every token to its meta tag', async () => {
    const { siteVerification } = await import('../site');
    delete process.env.SITE_VERIFICATION_GOOGLE;
    delete process.env.SITE_VERIFICATION_BING;
    delete process.env.SITE_VERIFICATION_YANDEX;
    expect(siteVerification()).toBeUndefined();

    process.env.SITE_VERIFICATION_GOOGLE = ' g-token ';
    process.env.SITE_VERIFICATION_BING = 'b-token';
    process.env.SITE_VERIFICATION_YANDEX = '';
    expect(siteVerification()).toEqual({ google: 'g-token', other: { 'msvalidate.01': ['b-token'] } });
  });
});
