// The public addresses of the project, in one place: the website renders the
// documentation, the API reference and a playground; the admin footer and the
// OpenAPI documents point at it
export const PROJECT_WEBSITE_URL = 'https://vocab-bloom-hub.com';
export const PROJECT_REPOSITORY_URL = 'https://github.com/Fristail27/vocab-bloom-hub';

// GitHub's "latest release" skips drafts and prereleases by itself: the update
// notice of the admin UI compares the running version with it (issue #477)
export const PROJECT_LATEST_RELEASE_API_URL =
  'https://api.github.com/repos/Fristail27/vocab-bloom-hub/releases/latest';

// where the update notice of the admin UI sends the reader: what the notice is
// and how an upgrade is done (docs/upgrading.md#update-notice)
export const UPDATE_NOTICE_DOCS_PATH = '/docs/upgrading#update-notice';

/** A page of the website in one interface locale: `projectWebsitePage('en', '/docs/api')` */
export const projectWebsitePage = (locale: string, path = ''): string =>
  `${PROJECT_WEBSITE_URL}/${locale}${path}`;
