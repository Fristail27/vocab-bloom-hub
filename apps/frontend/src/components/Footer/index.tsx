import Link from 'next/link';
import styles from './styles.module.scss';

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <span>Docs</span>
      <Link className={styles.link} href="https://github.com/Fristail27/vocab-bloom-hub" target="_blank">
        <i className="pi pi-github" style={{ color: 'var(--blue-500)' }}></i>
        Github
      </Link>
      <span>Version: 0.0.1</span>
    </footer>
  );
};
