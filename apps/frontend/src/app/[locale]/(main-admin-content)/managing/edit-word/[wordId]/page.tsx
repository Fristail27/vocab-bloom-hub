import { getTranslations } from 'next-intl/server';
import { Breadcrumb } from 'antd';
import { Title } from '@/core/ui/Title';
import { Icon } from '@/core/ui/Icon';
import { BreadcrumbSection } from '@/core/ui/Breadcrumb/components/ManagingBreadcrumbSection';
import { CommonPageP } from '@/types/common';
import { ServerEnApi } from '@/core/api/EnApi/ServerEnApi';
import { WordCard } from '../../_components/WordCard';
import { WordCardModeE } from '../../_components/WordCard/constants';
import styles from './styles.module.scss';

type EditPageP = {
  wordId: string;
};

export default async function EditWordPage({ params }: CommonPageP<EditPageP>) {
  const { locale, wordId } = await params;
  const wordData = await ServerEnApi.getWordById(+wordId);
  if ('error' in wordData) {
    // TODO
    return <div>3333</div>;
  }
  const t = await getTranslations('menu');
  const manageT = await getTranslations('managing');
  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/managing`, title: <BreadcrumbSection icon="managing" name={t('managing')} /> },
    { title: manageT('edit_word') },
  ];
  return (
    <div className={styles.page}>
      <Title level={2}>{manageT('edit_word')}</Title>
      <Breadcrumb items={breadCrumbs} />
      <WordCard word={wordData} mode={WordCardModeE.edit} />
    </div>
  );
}
