import { getTranslations } from 'next-intl/server';
import { Breadcrumb, Button } from 'antd';
import { Title } from '@/core/ui/Title';
import { CommonPageP } from '@/types/common';
import { Icon } from '@/core/ui/Icon';
import styles from './styles.module.scss';

export default async function ManagingPage({ params }: CommonPageP) {
  const { locale } = await params;
  const t = await getTranslations('menu');
  const manageT = await getTranslations('managing');
  return (
    <div className={styles.mainPage}>
      <Title level={2}>{t('managing')}</Title>
      <Breadcrumb
        items={[
          { href: '/', title: <Icon name="home" size="medium" /> },
          {
            title: (
              <div className={styles.breadcrumbItem}>
                <Icon name="managing" /> {t('managing')}
              </div>
            ),
          },
        ]}
      />
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
    </div>
  );
}
