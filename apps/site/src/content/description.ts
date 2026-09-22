import { trimDescription } from '@/core/site';

// A line that starts something other than a paragraph: a heading, a fence, a
// quote / callout, a list item, a table row, an image or badge line, an HTML
// block (the README's centred header), a horizontal rule
const NOT_PARAGRAPH = /^(#{1,6}\s|```|~~~|>|\s*[-*+]\s|\s*\d+[.)]\s|\||!\[|<|(?:-{3,}|\*{3,}|_{3,})\s*$)/;

// Inline HTML tags, removed until none is left: a tag that a removal
// uncovers (`<b<i></i>>`) goes in the next round. The text is a
// description, not markup — React escapes it in the attribute — but the
// stripping is complete either way
const withoutTags = (text: string): string => {
  let current = text;
  for (;;) {
    const next = current.replace(/<[^>]*>/g, '');
    if (next === current) return next;
    current = next;
  }
};

// inline Markdown → plain text, in the order the constructs nest. Emphasis
// with underscores is only the word-bounded form: `SERVER_PORT` is a name
const plainText = (markdown: string): string =>
  withoutTags(
    markdown
      .replace(/!\[[^\]]*]\([^)]*\)/g, '') // images
      .replace(/\[([^\]]*)]\([^)]*\)/g, '$1') // links → their text (a linked badge leaves nothing)
      .replace(/\[([^\]]+)]\[[^\]]*]/g, '$1') // reference links
      .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1'), // autolinks → the URL
  )
    .replace(/`([^`]+)`/g, '$1') // code spans
    .replace(/\*\*(.+?)\*\*/g, '$1') // strong
    .replace(/(^|[\s(])__(.+?)__(?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/\*([^*]+)\*/g, '$1') // emphasis
    .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1') // strikethrough
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1'); // escapes

/**
 * The first paragraph of a Markdown document as a search-snippet description
 * (issue #480): the docs pages had no `<meta name="description">` at all.
 * Headings, badges, the HTML header of the README, callouts, lists, tables
 * and code are skipped — the first run of prose lines is the paragraph, its
 * inline Markdown stripped and the text trimmed to a snippet's length.
 * `null` when the document has no prose at all
 */
export const firstParagraph = (markdown: string): string | null => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let fenced = false;
  // an HTML block (CommonMark): from a line starting with a tag up to a blank line
  let html = false;
  const paragraph: string[] = [];
  let next = 0;
  for (; next < lines.length; next += 1) {
    const line = (lines[next] as string).trim();
    if (/^(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (line === '') {
      html = false;
      if (paragraph.length > 0) break;
      continue;
    }
    if (html) continue;
    if (paragraph.length === 0) {
      if (line.startsWith('<')) {
        html = true;
        continue;
      }
      // a badge line, an image: Markdown that leaves no text is not prose
      if (NOT_PARAGRAPH.test(line) || plainText(line).trim() === '') continue;
    } else if (NOT_PARAGRAPH.test(line)) {
      // a heading or a block right after the prose ends the paragraph
      break;
    }
    paragraph.push(line);
  }
  if (paragraph.length === 0) return null;
  // a paragraph that introduces a list ("Two things tell you …:") is only
  // half a sentence: the items complete it
  if (/:$/.test(paragraph[paragraph.length - 1] as string)) {
    paragraph.push(...listItems(lines, next));
  }
  const text = plainText(paragraph.join(' ')).replace(/\s+/g, ' ').trim();
  return text ? trimDescription(text) : null;
};

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;

// the items of the list that starts after `from` (blank lines before it), as
// plain lines; continuation lines of an item are joined to it
const listItems = (lines: string[], from: number): string[] => {
  const items: string[] = [];
  let index = from;
  while (index < lines.length && (lines[index] as string).trim() === '') index += 1;
  for (; index < lines.length; index += 1) {
    const raw = lines[index] as string;
    if (raw.trim() === '') break;
    if (LIST_ITEM.test(raw)) items.push(raw.replace(LIST_ITEM, '').trim());
    else if (/^\s+\S/.test(raw) && items.length > 0) items[items.length - 1] += ` ${raw.trim()}`;
    else break;
  }
  return items;
};
