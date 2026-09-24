'use client';

import React, { useEffect, useId, useState } from 'react';

import { usePathname } from '@/i18n/navigation';

import styles from './styles.module.scss';

type NavMenuP = { label: string; children: React.ReactNode };

/**
 * The site navigation: a row of links on a wide screen, a menu behind a
 * button on a narrow one (issue #520). The links are rendered once, by the
 * server; this only opens and closes. The menu closes when the page changes
 * and on Escape.
 */
export const NavMenu = ({ label, children }: NavMenuP) => {
  const id = useId();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.toggleIcon} aria-hidden="true" />
      </button>
      <nav id={id} className={styles.nav} data-open={open || undefined}>
        {children}
      </nav>
    </>
  );
};
