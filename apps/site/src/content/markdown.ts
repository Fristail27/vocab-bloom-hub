import 'server-only';

import type { Element, Root } from 'hast';
import { toString as hastToString } from 'hast-util-to-string';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { rewriteRepoUrl } from './links';
import { slugForFile } from './registry';

export type HeadingT = { id: string; text: string; depth: 2 | 3 };

export type RenderedMarkdownT = {
  html: string;
  /** The h2 / h3 headings, for the table of contents */
  headings: HeadingT[];
  /** The first h1, when the document has one */
  title: string | null;
};

type RenderOptions = {
  /** The Markdown file, relative to the repository root — the base of its relative links */
  fromFile: string;
  locale: string;
};

// links and images between the repository files become site routes / GitHub URLs
const rehypeRepoUrls =
  ({ fromFile, locale }: RenderOptions) =>
  (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a' && typeof node.properties.href === 'string') {
        node.properties.href = rewriteRepoUrl(node.properties.href, fromFile, locale, slugForFile);
      }
      if (node.tagName === 'img' && typeof node.properties.src === 'string') {
        node.properties.src = rewriteRepoUrl(node.properties.src, fromFile, locale, slugForFile);
      }
    });
  };

const rehypeOutline = (out: { headings: HeadingT[]; title: string | null }) => (tree: Root) => {
  visit(tree, 'element', (node: Element) => {
    if (node.tagName === 'h1' && out.title === null) out.title = hastToString(node).trim();
    if ((node.tagName === 'h2' || node.tagName === 'h3') && typeof node.properties.id === 'string') {
      out.headings.push({
        id: node.properties.id,
        text: hastToString(node).trim(),
        depth: node.tagName === 'h2' ? 2 : 3,
      });
    }
  });
};

// fenced code in the docs uses names highlight.js has no grammar for
const PLAIN_TEXT_LANGUAGES = [
  'dotenv',
  'env',
  'txt',
  'text',
  'alloy',
  'caddyfile',
  'logql',
  'promql',
  'nginx',
  'toml',
  'ini',
  'mermaid',
];

/** GitHub-flavoured Markdown of the repository → HTML with slugged headings and highlighted code */
export const renderMarkdown = async (markdown: string, options: RenderOptions): Promise<RenderedMarkdownT> => {
  const outline: { headings: HeadingT[]; title: string | null } = { headings: [], title: null };

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    // the README carries HTML (the centred header, badges): keep it
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeHighlight, { plainText: PLAIN_TEXT_LANGUAGES })
    .use(rehypeRepoUrls, options)
    .use(rehypeOutline, outline)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return { html: String(file), headings: outline.headings, title: outline.title };
};
