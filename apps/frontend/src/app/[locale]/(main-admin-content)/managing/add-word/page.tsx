import { getTranslations } from 'next-intl/server';
import { Breadcrumb } from 'antd';
import { Title } from '@/core/ui/Title';
import { Icon } from '@/core/ui/Icon';
import { BreadcrumbSection } from '@/core/ui/Breadcrumb/components/ManagingBreadcrumbSection';
import { CommonPageP } from '@/types/common';
import { EnWordForm } from '../_components/EnWordForm';
import styles from './styles.module.scss';

export default async function AddWordPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const manageT = await getTranslations('managing');
  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/managing`, title: <BreadcrumbSection icon="managing" name={t('managing')} /> },
    { title: manageT('add_word') },
  ];
  return (
    <div className={styles.page}>
      <Title level={2}>{manageT('add_word')}</Title>
      <Breadcrumb items={breadCrumbs} />
      <EnWordForm />
    </div>
  );
}
