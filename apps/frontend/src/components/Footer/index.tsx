import Link from 'next/link';
import React from 'react';
import styles from './styles.module.scss';

type FooterP = {
  settings: Record<string, string>;
};

export const Footer: React.FC<FooterP> = ({ settings }) => {
  return (
    <footer className={styles.footer}>
      <span>Docs</span>
      <Link className={styles.link} href="https://github.com/Fristail27/vocab-bloom-hub" target="_blank">
        <i className="pi pi-github" style={{ color: 'var(--blue-500)' }}></i>
        Github
      </Link>
      <span>Version: {settings.version}</span>
    </footer>
  );
};
