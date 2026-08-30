import path from 'node:path/posix';

import { REPO_BLOB_URL, REPO_RAW_URL } from './repo';

const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']);

// absolute URLs, protocol-relative ones and in-page anchors are left alone
const isExternal = (url: string): boolean => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(url);

/**
 * A link inside a Markdown file of the repository, as the site renders it:
 * another documented file becomes the page that renders it, an image the raw
 * file on GitHub, any other repository file its GitHub page.
 *
 * @param url the href / src as written in `fromFile`
 * @param fromFile the Markdown file the link is in, relative to the repository root
 * @param locale locale prefix of the rewritten page routes
 * @param slugForFile resolves a repository file to the docs page rendering it
 */
export const rewriteRepoUrl = (
  url: string,
  fromFile: string,
  locale: string,
  slugForFile: (file: string) => string | undefined,
): string => {
  if (!url || isExternal(url)) return url;

  const [target, hash] = url.split('#');
  const suffix = hash ? `#${hash}` : '';
  // a bare `#anchor` was handled above; `file.md#anchor` resolves the file
  const resolved = path.normalize(path.join(path.dirname(fromFile), target));

  const slug = slugForFile(resolved);
  if (slug) return `/${locale}/docs/${slug}${suffix}`;

  if (IMAGE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) return `${REPO_RAW_URL}/${resolved}`;

  return `${REPO_BLOB_URL}/${resolved}${suffix}`;
};
