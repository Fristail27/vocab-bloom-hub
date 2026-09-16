import { rewriteRepoUrl } from '../links';

const slugs: Record<string, string> = {
  'README.md': 'getting-started',
  'docs/environment.md': 'environment',
  'docs/deployment/docker.md': 'deployment/docker',
  'DATA_LICENSE.md': 'data-license',
  'packages/npm-sdk/README.md': 'sdk/node',
};
const slugForFile = (file: string) => slugs[file];

describe('rewriteRepoUrl (links between the repository Markdown files)', () => {
  it('turns a link to a documented file into the docs route, from any directory', () => {
    expect(rewriteRepoUrl('docs/environment.md', 'README.md', 'en', slugForFile)).toBe('/en/docs/environment');
    expect(rewriteRepoUrl('./environment.md', 'docs/api.md', 'ru', slugForFile)).toBe('/ru/docs/environment');
    expect(rewriteRepoUrl('../environment.md', 'docs/deployment/README.md', 'en', slugForFile)).toBe(
      '/en/docs/environment',
    );
    expect(rewriteRepoUrl('../../DATA_LICENSE.md', 'docs/deployment/docker.md', 'en', slugForFile)).toBe(
      '/en/docs/data-license',
    );
    expect(rewriteRepoUrl('../packages/npm-sdk/README.md', 'docs/api.md', 'en', slugForFile)).toBe(
      '/en/docs/sdk/node',
    );
  });

  it('keeps the anchor', () => {
    expect(rewriteRepoUrl('./docker.md#quick-start', 'docs/deployment/README.md', 'en', slugForFile)).toBe(
      '/en/docs/deployment/docker#quick-start',
    );
  });

  it('sends an anchored link to the locale of the linked file when the page would render another language', () => {
    const files: Record<string, Record<string, string>> = {
      environment: { en: 'docs/environment.md', ru: 'docs/environment.ru.md' },
      'deployment/docker': { en: 'docs/deployment/docker.md' },
      'getting-started': { en: 'README.md', ru: 'docs/README.ru.md', de: 'docs/README.de.md' },
    };
    const rendered = (slug: string, locale: string) => files[slug]?.[locale] ?? files[slug]?.en ?? '';
    const withRu: Record<string, string> = {
      ...slugs,
      'docs/environment.ru.md': 'environment',
      'docs/README.ru.md': 'getting-started',
    };
    const resolve = (file: string) => withRu[file];
    // an English guide read under /ru: the Russian environment page has no English heading
    expect(
      rewriteRepoUrl('./environment.md#database-driver-locking', 'docs/migrations.md', 'ru', resolve, rendered),
    ).toBe('/en/docs/environment#database-driver-locking');
    // the same link without an anchor stays in the reader's locale
    expect(rewriteRepoUrl('./environment.md', 'docs/migrations.md', 'ru', resolve, rendered)).toBe(
      '/ru/docs/environment',
    );
    // a page rendered in English under /ru anyway keeps the anchor in place
    expect(
      rewriteRepoUrl('./docker.md#quick-start', 'docs/deployment/README.md', 'ru', resolve, rendered),
    ).toBe('/ru/docs/deployment/docker#quick-start');
    // a Russian page linking the Russian file: its own locale
    expect(rewriteRepoUrl('./environment.ru.md#фиксация', 'docs/api.ru.md', 'ru', resolve, rendered)).toBe(
      '/ru/docs/environment#фиксация',
    );
    // CONTRIBUTING.md (English) read under /de: the German README has no #native-start
    expect(rewriteRepoUrl('./README.md#native-start', 'CONTRIBUTING.md', 'de', resolve, rendered)).toBe(
      '/en/docs/getting-started#native-start',
    );
  });

  it('leaves in-page anchors, absolute and site-absolute URLs alone', () => {
    expect(rewriteRepoUrl('#-overview', 'README.md', 'en', slugForFile)).toBe('#-overview');
    expect(rewriteRepoUrl('https://nestjs.com/', 'README.md', 'en', slugForFile)).toBe('https://nestjs.com/');
    expect(rewriteRepoUrl('mailto:a@b.c', 'README.md', 'en', slugForFile)).toBe('mailto:a@b.c');
    expect(rewriteRepoUrl('/en/api', 'README.md', 'en', slugForFile)).toBe('/en/api');
  });

  it('points other repository files at GitHub, images at the raw file', () => {
    expect(rewriteRepoUrl('LICENSE', 'README.md', 'en', slugForFile)).toBe(
      'https://github.com/Fristail27/vocab-bloom-hub/blob/main/LICENSE',
    );
    expect(rewriteRepoUrl('../apps/server/openapi/public-v1.json', 'docs/api.md', 'en', slugForFile)).toBe(
      'https://github.com/Fristail27/vocab-bloom-hub/blob/main/apps/server/openapi/public-v1.json',
    );
    expect(rewriteRepoUrl('.github/assets/main-readme-logo.svg', 'README.md', 'en', slugForFile)).toBe(
      'https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/.github/assets/main-readme-logo.svg',
    );
    expect(
      rewriteRepoUrl('examples/ecosystem.config.cjs', 'docs/deployment/README.md', 'en', slugForFile),
    ).toBe(
      'https://github.com/Fristail27/vocab-bloom-hub/blob/main/docs/deployment/examples/ecosystem.config.cjs',
    );
  });
});
