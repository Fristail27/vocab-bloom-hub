import type { Metadata } from 'next';
import { LoginForm } from '@/app/[locale]/login/_components/LoginForm';
import styles from './styles.module.scss';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the administration panel of this Vocab Bloom Hub instance.',
};

export default function LoginPage() {
  return (
    <div className={styles.loginPage}>
      <LoginForm />
    </div>
  );
}
