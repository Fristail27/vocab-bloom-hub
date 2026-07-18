import { getTranslations } from 'next-intl/server';
import { Breadcrumb } from 'antd';
import { Title } from '@/core/ui/Title';
import { Icon } from '@/core/ui/Icon';
import { BreadcrumbSection } from '@/core/ui/Breadcrumb/components/ManagingBreadcrumbSection';
import { CommonPageP } from '@/types/common';
import { ImportDictionarySection } from './_components/ImportDictionarySection';
import { ExportDictionarySection } from './_components/ExportDictionarySection';
import styles from './styles.module.scss';

export default async function ImportDictionaryPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const manageT = await getTranslations('managing');
  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/managing`, title: <BreadcrumbSection icon="managing" name={t('managing')} /> },
    { title: manageT('import_dictionary') },
  ];
  return (
    <div className={styles.page}>
      <Title level={2}>{manageT('import_dictionary')}</Title>
      <Breadcrumb items={breadCrumbs} />
      <ImportDictionarySection />
      <ExportDictionarySection />
    </div>
  );
}
