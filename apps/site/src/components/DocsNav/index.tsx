'use client';

import React from 'react';

import { Link, usePathname } from '@/i18n/navigation';

import styles from './styles.module.scss';

export type DocsNavSectionT = {
  key: string;
  title: string;
  pages: { slug: string; title: string }[];
};

type DocsNavP = { sections: DocsNavSectionT[] };

/** The sidebar of the documentation: every page, the current one marked */
export const DocsNav = ({ sections }: DocsNavP) => {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {sections.map((section) => (
        <div key={section.key} className={styles.section}>
          <h4>{section.title}</h4>
          <ul>
            {section.pages.map((page) => {
              const href = `/docs/${page.slug}`;
              const active = pathname === href;

              return (
                <li key={page.slug}>
                  <Link
                    href={href}
                    className={active ? styles.active : undefined}
                    aria-current={active ? 'page' : undefined}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};
