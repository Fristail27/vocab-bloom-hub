/**
 * One level-2 section of a Markdown file as a page of its own: from the
 * matching `## ` heading up to the next `## ` heading, with every heading
 * promoted one level (the section heading becomes the page title, its
 * `### ` subsections the entries of the table of contents). The heading ids
 * do not change: slugs are made from the text, not the level, so links into
 * the section (`README.md#native-start`) keep working.
 *
 * The docs site renders the README's getting-started section this way, in
 * every language of the README (issue #440): one source, no copy in docs/.
 */
export const extractSection = (markdown: string, heading: RegExp): string | null => {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return null;
  let end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  if (end < 0) end = lines.length;
  return lines
    .slice(start, end)
    .map((line) => (/^#{2,6} /.test(line) ? line.slice(1) : line))
    .join('\n')
    .trim();
};
