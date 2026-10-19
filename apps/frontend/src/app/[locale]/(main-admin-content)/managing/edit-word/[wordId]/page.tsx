import { EN_STATISTICS_ISSUE_KEYS, EnStatisticsIssueKeyT } from 'server/types';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Breadcrumb, Button, Result } from 'antd';
import { ErrorCodes } from 'server/core/constants/error_codes';
import { Title } from '@/core/ui/Title';
import { Icon } from '@/core/ui/Icon';
import { BreadcrumbSection } from '@/core/ui/Breadcrumb/components/ManagingBreadcrumbSection';
import { CommonPageP } from '@/types/common';
import { ServerEnApi } from '@/core/api/EnApi/ServerEnApi';
import { getEditedDataset } from '@/helpers/getEditedDataset';
import { WordCard } from '../../_components/WordCard';
import { WordCardModeE } from '../../_components/WordCard/constants';
import styles from './styles.module.scss';

type EditPageP = {
  wordId: string;
};

export default async function EditWordPage({
  params,
  searchParams,
}: CommonPageP<EditPageP> & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const namedDataset = Array.isArray(query.dataset) ? query.dataset[0] : query.dataset;
  const category =
    typeof query.category === 'string' &&
    EN_STATISTICS_ISSUE_KEYS.includes(query.category as EnStatisticsIssueKeyT)
      ? query.category
      : undefined;
  const page = typeof query.page === 'string' && /^[1-9]\d*$/.test(query.page) ? query.page : '1';
  const { locale, wordId } = await params;
  const [wordData, datasets] = await Promise.all([
    ServerEnApi.getWordById(+wordId, namedDataset),
    // the dataset the word is edited in, for the license of the edit (issues #531, #540)
    ServerEnApi.getDatasets(),
  ]);
  const dataset = namedDataset
    ? 'error' in datasets
      ? undefined
      : datasets.datasets.find((item) => item.installed && item.name === namedDataset)
    : await getEditedDataset(datasets);
  const statsT = await getTranslations('statistics');
  const backToIssues =
    category && (namedDataset || dataset)
      ? `/${locale}/statistics/issues?${new URLSearchParams({ dataset: namedDataset || dataset!.name, category, page })}`
      : undefined;
  const t = await getTranslations('menu');
  const manageT = await getTranslations('managing');
  if ('error' in wordData) {
    const tError = await getTranslations('errors');
    const isKnownCode = (Object.values(ErrorCodes) as string[]).includes(wordData.message);
    return (
      <div className={styles.page}>
        <Result
          status={wordData.message === ErrorCodes.word_doesnt_found ? '404' : 'error'}
          title={tError(isKnownCode ? wordData.message : ErrorCodes.unknown_error)}
          extra={
            backToIssues ? (
              <a href={backToIssues}>{statsT('back_to_matches')}</a>
            ) : (
              <Link href={`/${locale}/managing`}>
                <Button type="primary">{manageT('back_to_managing')}</Button>
              </Link>
            )
          }
        />
      </div>
    );
  }
  const breadCrumbs = [
    { href: `/${locale}`, title: <Icon name="home" size="medium" /> },
    { href: `/${locale}/managing`, title: <BreadcrumbSection icon="managing" name={t('managing')} /> },
    { title: manageT('edit_word') },
  ];
  return (
    <div className={styles.page}>
      <Title level={2}>{manageT('edit_word')}</Title>
      <Breadcrumb items={breadCrumbs} />
      {backToIssues && (
        // A fresh document also refreshes counts when the last row on this page was corrected.
        <a href={backToIssues}>{statsT('back_to_matches')}</a>
      )}
      <WordCard
        key={`${dataset?.name}:${wordId}`}
        word={wordData}
        mode={WordCardModeE.edit}
        dataset={dataset}
      />
    </div>
  );
}
