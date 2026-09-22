import fs from 'node:fs';
import path from 'node:path';

import { DOC_PAGES, docFile, docLocales, findDocBySlug, slugForFile } from '../registry';
import { extractSection } from '../sections';
import { InterfaceLanguageEnum } from '@/types/common';

// The registry is the one list of documented files (issues #330, #404): a
// page whose file moved or a translation that was renamed must fail here,
// not at build time. The repository root is taken from this file, not from
// the working directory jest happens to run in
const root = path.resolve(__dirname, '../../../../..');

describe('the docs registry', () => {
  it('points every page and every translated version at an existing file', () => {
    for (const page of DOC_PAGES) {
      expect({ slug: page.slug, exists: fs.existsSync(path.join(root, page.file)) }).toEqual({
        slug: page.slug,
        exists: true,
      });
      for (const [locale, file] of Object.entries(page.translations ?? {})) {
        expect({ slug: page.slug, locale, exists: fs.existsSync(path.join(root, file)) }).toEqual({
          slug: page.slug,
          locale,
          exists: true,
        });
        // the convention: <name>.<lang>.md next to the English file; the root
        // README is the one exception, its translations live under docs/
        const expected =
          page.file === 'README.md' ? `docs/README.${locale}.md` : page.file.replace(/\.md$/, `.${locale}.md`);
        expect({ slug: page.slug, locale, file }).toEqual({ slug: page.slug, locale, file: expected });
      }
    }
  });

  it('renders the README in every interface language and the other pages in English elsewhere', () => {
    const overview = findDocBySlug('getting-started')!;
    for (const locale of Object.values(InterfaceLanguageEnum)) {
      expect(docFile(overview, locale)).toBe(
        locale === InterfaceLanguageEnum.en ? 'README.md' : `docs/README.${locale}.md`,
      );
    }
    const operations = findDocBySlug('operations')!;
    expect(docFile(operations, InterfaceLanguageEnum.de)).toBe('docs/operations.md');
    expect(slugForFile('docs/README.de.md')).toBe('getting-started');
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

  it('finds the section a page renders in the English file and in every translation', () => {
    for (const page of DOC_PAGES.filter((p) => p.extract)) {
      for (const file of [page.file, ...Object.values(page.translations ?? {})]) {
        const markdown = fs.readFileSync(path.join(root, file), 'utf8');
        expect({ file, section: extractSection(markdown, page.extract!)?.split('\n')[0] ?? null }).toEqual({
          file,
          section: expect.stringMatching(/^# /),
        });
      }
    }
  });

  it('lists the release notes so a link to CHANGELOG.md stays on the site', () => {
    expect(slugForFile('CHANGELOG.md')).toBe('changelog');
  });
});

describe('docLocales (issue #480)', () => {
  it('is English plus the translations the repository has, nothing else', () => {
    expect(docLocales(findDocBySlug('operations')!)).toEqual([InterfaceLanguageEnum.en]);
    expect(docLocales(findDocBySlug('api')!)).toEqual([InterfaceLanguageEnum.en, InterfaceLanguageEnum.ru]);
    expect(docLocales(findDocBySlug('getting-started')!)).toHaveLength(
      Object.values(InterfaceLanguageEnum).length,
    );
  });
});
