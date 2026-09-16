import path from 'node:path/posix';

import { REPO_BLOB_URL, REPO_RAW_URL } from './repo';

const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']);

// absolute URLs, protocol-relative ones and in-page anchors are left alone
const isExternal = (url: string): boolean => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(url);

/** The language a repository Markdown file is written in: `<name>.<lang>.md` is a translation, anything else English */
export const localeOfFile = (file: string): string =>
  /\.([a-z]{2})\.md$/i.exec(file)?.[1]?.toLowerCase() ?? 'en';

/**
 * A link inside a Markdown file of the repository, as the site renders it:
 * another documented file becomes the page that renders it, an image the raw
 * file on GitHub, any other repository file its GitHub page.
 *
 * A link with an anchor names a heading of the linked file, and a translation
 * of that file has other headings: when the page would render another file in
 * `locale` (an English guide linking `api.md#caching`, read under /ru where
 * the API page is Russian), the link goes to the locale of the linked file
 * itself, where the anchor exists — instead of a route that scrolls nowhere.
 *
 * @param url the href / src as written in `fromFile`
 * @param fromFile the Markdown file the link is in, relative to the repository root
 * @param locale locale prefix of the rewritten page routes
 * @param slugForFile resolves a repository file to the docs page rendering it
 * @param renderedFile the file the page of `slug` renders in a locale (the English one or its translation)
 */
export const rewriteRepoUrl = (
  url: string,
  fromFile: string,
  locale: string,
  slugForFile: (file: string) => string | undefined,
  renderedFile?: (slug: string, locale: string) => string,
): string => {
  if (!url || isExternal(url)) return url;

  const [target, hash] = url.split('#');
  const suffix = hash ? `#${hash}` : '';
  // a bare `#anchor` was handled above; `file.md#anchor` resolves the file
  const resolved = path.normalize(path.join(path.dirname(fromFile), target));

  const slug = slugForFile(resolved);
  if (slug) {
    const routeLocale =
      hash && renderedFile && renderedFile(slug, locale) !== resolved ? localeOfFile(resolved) : locale;
    return `/${routeLocale}/docs/${slug}${suffix}`;
  }

  if (IMAGE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) return `${REPO_RAW_URL}/${resolved}`;

  return `${REPO_BLOB_URL}/${resolved}${suffix}`;
};
