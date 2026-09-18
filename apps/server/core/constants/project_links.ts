// The public addresses of the project, in one place: the website renders the
// documentation, the API reference and a playground; the admin footer and the
// OpenAPI documents point at it
export const PROJECT_WEBSITE_URL = 'https://vocab-bloom-hub.com';
export const PROJECT_REPOSITORY_URL = 'https://github.com/Fristail27/vocab-bloom-hub';

/** A page of the website in one interface locale: `projectWebsitePage('en', '/docs/api')` */
export const projectWebsitePage = (locale: string, path = ''): string =>
  `${PROJECT_WEBSITE_URL}/${locale}${path}`;
