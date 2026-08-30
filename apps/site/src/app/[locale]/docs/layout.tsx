import React from 'react';
import { getTranslations } from 'next-intl/server';

import { DocsNav, DocsNavSectionT } from '@/components/DocsNav';
import { DOC_PAGES, DOC_SECTIONS, docTitle } from '@/content/registry';
import { LocaleParamsP } from '@/types/common';

import styles from './docs.module.scss';

type DocsLayoutP = Readonly<{ children: React.ReactNode }> & LocaleParamsP;

export default async function DocsLayout({ children, params }: DocsLayoutP) {
  const { locale } = await params;
  const t = await getTranslations('docs');

  const sections: DocsNavSectionT[] = DOC_SECTIONS.map((section) => ({
    key: section,
    title: t(`sections.${section}`),
    pages: DOC_PAGES.filter((page) => page.section === section).map((page) => ({
      slug: page.slug,
      title: docTitle(page, locale),
    })),
  }));

  return (
    <div className={`container ${styles.layout}`}>
      <aside className={styles.sidebar}>
        <DocsNav sections={sections} />
      </aside>
      <div>{children}</div>
    </div>
  );
}
