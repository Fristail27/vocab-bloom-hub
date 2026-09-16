import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { rehypeCallouts } from '../callouts';

const render = (markdown: string, titles?: Parameters<typeof rehypeCallouts>[0]) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeCallouts, titles)
      .use(rehypeStringify)
      .processSync(markdown),
  );

describe('rehypeCallouts', () => {
  it('turns a GitHub alert into a titled callout block', () => {
    const html = render('> [!WARNING]\n> Keep it off the internet: it lists routes.\n\nAfter.');
    expect(html).toContain('<div class="callout callout-warning" role="note" data-callout="warning">');
    expect(html).toContain('<p class="callout-title">Warning</p>');
    expect(html).toContain('<p>Keep it off the internet: it lists routes.</p>');
    expect(html).not.toContain('[!WARNING]');
    expect(html).not.toContain('<blockquote>');
  });

  it('keeps the rest of the quote — several paragraphs, inline code, a list', () => {
    const html = render('> [!TIP]\n> First `code` line.\n>\n> - one\n> - two\n>\n> Second paragraph.');
    expect(html).toContain('callout-tip');
    expect(html).toContain('<p>First <code>code</code> line.</p>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<p>Second paragraph.</p>');
  });

  it('titles the block in the page language', () => {
    const html = render('> [!CAUTION]\n> Deletes the volume.', {
      note: 'Примечание',
      tip: 'Совет',
      important: 'Важно',
      warning: 'Внимание',
      caution: 'Осторожно',
    });
    expect(html).toContain('<p class="callout-title">Осторожно</p>');
  });

  it('leaves an ordinary blockquote and an unknown marker alone', () => {
    expect(render('> Just a quote.')).toContain('<blockquote>\n<p>Just a quote.</p>\n</blockquote>');
    expect(render('> [!DANGER]\n> Not a GitHub alert.')).toContain('[!DANGER]');
  });
});
