/**
 * The Markdown of one `## ` section: from its heading (matched by `pattern`
 * against the heading text) to the next `## ` heading or thematic break,
 * without the heading itself. Null when the heading is not there
 */
export const extractSection = (markdown: string, pattern: RegExp): string | null => {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^## /.test(line) && pattern.test(line.slice(3)));
  if (start === -1) return null;

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line) || /^---\s*$/.test(line)) break;
    body.push(line);
  }

  return body.join('\n').trim();
};
