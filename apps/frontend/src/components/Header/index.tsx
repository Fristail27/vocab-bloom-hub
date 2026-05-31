import { LanguageSwitch } from '@/components/LanguageSwitch';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { MainLogoWithTitle } from '@/core/ui/logo';
import styles from './styles.module.scss';

export const Header = async () => {
  return (
    <header className={styles.loginHeader}>
      <MainLogoWithTitle width={280} height={60} />
      <div className={styles.rightPart}>
        <ThemeSwitch />
        <LanguageSwitch />
      </div>
    </header>
  );
};
