import { InterfaceLanguageEnum } from '@/types/common';

export enum DocSectionE {
  start = 'start',
  deployment = 'deployment',
  operations = 'operations',
  api = 'api',
  data = 'data',
  project = 'project',
}

export type DocPageT = {
  /** Route segment(s) under /docs */
  slug: string;
  /** The Markdown file, relative to the repository root */
  file: string;
  /** A Russian version of the same page, when the repository has one (`<name>.ru.md` next to the English file) */
  ruFile?: string;
  section: DocSectionE;
  title: string;
  titleRu: string;
};

// The documentation of the repository, one page per Markdown file. Order is
// the order in the sidebar
export const DOC_PAGES: DocPageT[] = [
  {
    slug: 'overview',
    file: 'README.md',
    ruFile: 'docs/README.ru.md',
    section: DocSectionE.start,
    title: 'Overview',
    titleRu: 'Обзор',
  },
  {
    slug: 'deployment',
    file: 'docs/deployment/README.md',
    ruFile: 'docs/deployment/README.ru.md',
    section: DocSectionE.deployment,
    title: 'Deployment',
    titleRu: 'Развёртывание',
  },
  {
    slug: 'deployment/docker',
    file: 'docs/deployment/docker.md',
    section: DocSectionE.deployment,
    title: 'Docker',
    titleRu: 'Docker',
  },
  {
    slug: 'deployment/reverse-proxy',
    file: 'docs/deployment/reverse-proxy.md',
    section: DocSectionE.deployment,
    title: 'Reverse proxy',
    titleRu: 'Reverse proxy',
  },
  {
    slug: 'environment',
    file: 'docs/environment.md',
    ruFile: 'docs/environment.ru.md',
    section: DocSectionE.deployment,
    title: 'Environment variables',
    titleRu: 'Переменные окружения',
  },
  {
    slug: 'operations',
    file: 'docs/operations.md',
    section: DocSectionE.operations,
    title: 'Operations',
    titleRu: 'Эксплуатация',
  },
  {
    slug: 'migrations',
    file: 'docs/migrations.md',
    section: DocSectionE.operations,
    title: 'Migrations',
    titleRu: 'Миграции',
  },
  {
    slug: 'observability',
    file: 'docs/observability.md',
    section: DocSectionE.operations,
    title: 'Observability',
    titleRu: 'Наблюдаемость',
  },
  {
    slug: 'performance',
    file: 'docs/performance.md',
    section: DocSectionE.operations,
    title: 'Performance',
    titleRu: 'Производительность',
  },
  {
    slug: 'offline-import',
    file: 'docs/offline-import.md',
    section: DocSectionE.operations,
    title: 'Offline import',
    titleRu: 'Офлайн-импорт',
  },
  {
    slug: 'api',
    file: 'docs/api.md',
    ruFile: 'docs/api.ru.md',
    section: DocSectionE.api,
    title: 'API surfaces',
    titleRu: 'Устройство API',
  },
  {
    slug: 'authentication',
    file: 'docs/authentication.md',
    section: DocSectionE.api,
    title: 'Authentication',
    titleRu: 'Аутентификация',
  },
  {
    slug: 'sdk/node',
    file: 'packages/npm-sdk/README.md',
    section: DocSectionE.api,
    title: 'Node.js SDK',
    titleRu: 'Node.js SDK',
  },
  {
    slug: 'sdk/python',
    file: 'packages/python-sdk/README.md',
    section: DocSectionE.api,
    title: 'Python SDK',
    titleRu: 'Python SDK',
  },
  {
    slug: 'data',
    file: 'docs/data.md',
    section: DocSectionE.data,
    title: 'The data',
    titleRu: 'Данные',
  },
  {
    slug: 'data-license',
    file: 'DATA_LICENSE.md',
    section: DocSectionE.data,
    title: 'Data license',
    titleRu: 'Лицензия данных',
  },
  {
    slug: 'contributing',
    file: 'CONTRIBUTING.md',
    section: DocSectionE.project,
    title: 'Contributing',
    titleRu: 'Участие в разработке',
  },
  {
    slug: 'security',
    file: 'SECURITY.md',
    section: DocSectionE.project,
    title: 'Security policy',
    titleRu: 'Политика безопасности',
  },
  // the curated release notes (issue #404): every tagged release has a page
  // on the site, and a link to CHANGELOG.md from any documented file lands here
  {
    slug: 'changelog',
    file: 'CHANGELOG.md',
    section: DocSectionE.project,
    title: 'Release notes',
    titleRu: 'История версий',
  },
];

export const DOC_SECTIONS: DocSectionE[] = Object.values(DocSectionE);

export const findDocBySlug = (slug: string): DocPageT | undefined =>
  DOC_PAGES.find((page) => page.slug === slug);

/** The page rendered from a repository file, for rewriting the links between the Markdown files */
export const slugForFile = (file: string): string | undefined =>
  DOC_PAGES.find((page) => page.file === file || page.ruFile === file)?.slug;

export const docTitle = (page: DocPageT, locale: InterfaceLanguageEnum): string =>
  locale === InterfaceLanguageEnum.ru ? page.titleRu : page.title;

/** The file a page is rendered from in a locale: the Russian version when there is one */
export const docFile = (page: DocPageT, locale: InterfaceLanguageEnum): string =>
  locale === InterfaceLanguageEnum.ru && page.ruFile ? page.ruFile : page.file;
