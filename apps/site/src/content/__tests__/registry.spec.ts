import fs from 'node:fs';
import path from 'node:path';

import { DOC_PAGES, docFile, findDocBySlug, slugForFile } from '../registry';
import { InterfaceLanguageEnum } from '@/types/common';

// The registry is the one list of documented files (issues #330, #404): a
// page whose file moved or a translation that was renamed must fail here,
// not at build time. The repository root is taken from this file, not from
// the working directory jest happens to run in
const root = path.resolve(__dirname, '../../../../..');

describe('the docs registry', () => {
  it('points every page and every Russian version at an existing file', () => {
    for (const page of DOC_PAGES) {
      expect({ slug: page.slug, exists: fs.existsSync(path.join(root, page.file)) }).toEqual({
        slug: page.slug,
        exists: true,
      });
      if (page.ruFile) {
        expect({ slug: page.slug, exists: fs.existsSync(path.join(root, page.ruFile)) }).toEqual({
          slug: page.slug,
          exists: true,
        });
        // the convention: <name>.ru.md next to the English file; the root
        // README is the one exception, its Russian version lives under docs/
        const expected = page.file === 'README.md' ? 'docs/README.ru.md' : page.file.replace(/\.md$/, '.ru.md');
        expect(page.ruFile).toBe(expected);
      }
    }
  });

  it('has unique slugs and resolves both files of a page to its slug', () => {
    const slugs = DOC_PAGES.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const api = findDocBySlug('api')!;
    expect(slugForFile('docs/api.md')).toBe('api');
    expect(slugForFile('docs/api.ru.md')).toBe('api');
    expect(docFile(api, InterfaceLanguageEnum.ru)).toBe('docs/api.ru.md');
    expect(docFile(api, InterfaceLanguageEnum.en)).toBe('docs/api.md');
  });

  it('lists the release notes so a link to CHANGELOG.md stays on the site', () => {
    expect(slugForFile('CHANGELOG.md')).toBe('changelog');
  });
});
