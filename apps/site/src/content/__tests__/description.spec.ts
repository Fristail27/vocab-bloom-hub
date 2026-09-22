import fs from 'node:fs';
import path from 'node:path';

import { firstParagraph } from '../description';
import { DOC_PAGES, docFile } from '../registry';
import { extractSection } from '../sections';
import { InterfaceLanguageEnum } from '@/types/common';

const root = path.resolve(__dirname, '../../../../..');

// The description of a docs page is its first paragraph (issue #480)
describe('firstParagraph', () => {
  it('skips the heading, badges and callouts and strips the inline Markdown', () => {
    const markdown = [
      '# Title',
      '',
      '[![CI](https://img.shields.io/badge.svg)](https://example.test)',
      '',
      '> [!NOTE]',
      '> A callout is not the description.',
      '',
      'The **first** paragraph, with `code`, a [link](./other.md) and',
      'a second line of the *same* paragraph.',
      '',
      'The second paragraph.',
    ].join('\n');

    expect(firstParagraph(markdown)).toBe(
      'The first paragraph, with code, a link and a second line of the same paragraph.',
    );
  });

  it('skips fenced code, lists, tables and HTML blocks', () => {
    const markdown = [
      '<p align="center">',
      '  <img src="logo.svg">',
      '</p>',
      '',
      '```bash',
      'not this',
      '```',
      '',
      '- not a list item',
      '',
      '| not | a table |',
      '',
      'Prose at last.',
      '## Next heading',
    ].join('\n');

    expect(firstParagraph(markdown)).toBe('Prose at last.');
  });

  it('trims to a snippet and answers null for a document without prose', () => {
    expect(firstParagraph(`# Only a heading\n\n${'word '.repeat(80)}`)?.length).toBeLessThanOrEqual(160);
    expect(firstParagraph('# Only a heading\n\n```\ncode\n```')).toBeNull();
    expect(firstParagraph('')).toBeNull();
  });

  it('finds a description for every documented page in every locale it is rendered in', () => {
    for (const page of DOC_PAGES) {
      for (const locale of Object.values(InterfaceLanguageEnum)) {
        const source = fs.readFileSync(path.join(root, docFile(page, locale)), 'utf8');
        const markdown = page.extract ? extractSection(source, page.extract) : source;
        const description = firstParagraph(markdown ?? '');
        expect({ slug: page.slug, locale, description }).toEqual({
          slug: page.slug,
          locale,
          description: expect.stringMatching(/^\S.{20,}$/),
        });
      }
    }
  });
});

describe('firstParagraph inline syntax', () => {
  it('strips nested and half-open tags completely', () => {
    // a tag uncovered by removing another is removed too: no tag survives
    expect(firstParagraph('a <scr<b></b>ipt>alert(1)</scr<i></i>ipt> c')).not.toMatch(/<[^>]*>/);
    expect(firstParagraph('a <b>bold</b> and <span class="x">x</span>')).toBe('a bold and x');
  });

  it('keeps autolinks and names with underscores, unwraps word-bounded emphasis', () => {
    expect(
      firstParagraph(
        '`SERVER_PORT` and _FRONT_PORT_ and _emphasis_ on <http://localhost:3010>, __strong__ and *em*.',
      ),
    ).toBe('SERVER_PORT and _FRONT_PORT_ and emphasis on http://localhost:3010, strong and em.');
  });
});

describe('firstParagraph before a list', () => {
  it('completes a paragraph that ends with a colon with the items of the list it introduces', () => {
    const markdown = [
      '# T',
      '',
      'Two things tell you how it is doing:',
      '',
      '- **Metrics** — a Prometheus endpoint',
      '  on the server.',
      '- **Logs** — one line per request.',
      '',
      'Not this.',
    ].join('\n');

    expect(firstParagraph(markdown)).toBe(
      'Two things tell you how it is doing: Metrics — a Prometheus endpoint on the server. Logs — one line per request.',
    );
  });
});
