import { rewriteRepoUrl } from '../links';

const slugs: Record<string, string> = {
  'README.md': 'overview',
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
