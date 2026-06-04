import { getTranslations } from 'next-intl/server';
import { Breadcrumb, Button } from 'antd';
import { Title } from '@/core/ui/Title';
import { CommonPageP } from '@/types/common';
import { Icon } from '@/core/ui/Icon';
import styles from './styles.module.scss';
import { BreadcrumbSection } from '@/core/ui/Breadcrumb/components/ManagingBreadcrumbSection';
import { SearchModule } from '@/app/[locale]/(main-admin-content)/managing/_components/SearchModule';

export default async function ManagingPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const manageT = await getTranslations('managing');
  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { title: <BreadcrumbSection icon="managing" name={t('managing')} /> },
  ];

  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('managing')}</Title>
      <Breadcrumb items={breadCrumbs} />
      <div className={styles.headerBtns}>
        <Button type="primary" href={`/${locale}/managing/add-word`}>
          {manageT('add_word')}
        </Button>
        <Button type="primary" href={`/${locale}/managing/add-phrase`}>
          {manageT('add_phrase')}
        </Button>
        <Button type="primary" href={`/${locale}/managing/add-grammar-patten`}>
          {manageT('add_grammar_patten')}
        </Button>
      </div>
      <SearchModule />
    </div>
  );
}
