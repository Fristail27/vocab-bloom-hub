import type { Element, ElementContent, Root, Text } from 'hast';
import { visit } from 'unist-util-visit';

/** The GitHub alert types: `> [!NOTE]` … `> [!CAUTION]` as the first line of a blockquote */
export const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type CalloutTypeT = (typeof CALLOUT_TYPES)[number];
export type CalloutTitlesT = Record<CalloutTypeT, string>;

export const DEFAULT_CALLOUT_TITLES: CalloutTitlesT = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

const firstParagraph = (node: Element): Element | undefined =>
  node.children.find((child): child is Element => child.type === 'element' && child.tagName === 'p');

const firstText = (node: Element): Text | undefined =>
  node.children.find((child): child is Text => child.type === 'text');

/**
 * GitHub-style alerts (https://docs.github.com/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts):
 * a blockquote whose first line is `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or
 * `[!CAUTION]` becomes `<div class="callout callout-<type>">` with a title line, the way
 * GitHub renders it — the docs pages use them for the asides.
 */
export const rehypeCallouts =
  (titles: CalloutTitlesT = DEFAULT_CALLOUT_TITLES) =>
  (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'blockquote') return;
      const paragraph = firstParagraph(node);
      const text = paragraph && firstText(paragraph);
      const match = text && MARKER.exec(text.value);
      if (!paragraph || !text || !match) return;

      const type = match[1].toLowerCase() as CalloutTypeT;
      text.value = text.value.slice(match[0].length);
      // `[!NOTE]` alone on its line leaves an empty text node (and a leading line break) behind
      if (text.value === '') paragraph.children = paragraph.children.filter((child) => child !== text);
      while (paragraph.children[0]?.type === 'element' && paragraph.children[0].tagName === 'br')
        paragraph.children.shift();
      if (paragraph.children.length === 0) node.children = node.children.filter((child) => child !== paragraph);

      const title: ElementContent = {
        type: 'element',
        tagName: 'p',
        properties: { className: ['callout-title'] },
        children: [{ type: 'text', value: titles[type] }],
      };
      node.tagName = 'div';
      node.properties = { className: ['callout', `callout-${type}`], role: 'note', dataCallout: type };
      node.children = [title, ...node.children];
    });
  };
