import { getTranslations } from 'next-intl/server';
import { Title } from '@/core/ui/Title';
import styles from './styles.module.scss';

export default async function AddWordPage() {
  const manageT = await getTranslations('managing');
  return (
    <div className={styles.page}>
      <Title level={2}>{manageT('add_word')}</Title>
    </div>
  );
}
