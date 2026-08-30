import React from 'react';

import type { HeadingT } from '@/content/markdown';

import styles from './styles.module.scss';

type TocP = { headings: HeadingT[]; title: string };

export const Toc = ({ headings, title }: TocP) => {
  if (headings.length === 0) return null;

  return (
    <nav className={styles.toc} aria-label={title}>
      <h4>{title}</h4>
      <ul>
        {headings.map((heading) => (
          <li key={heading.id} className={heading.depth === 3 ? styles.depth3 : undefined}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
