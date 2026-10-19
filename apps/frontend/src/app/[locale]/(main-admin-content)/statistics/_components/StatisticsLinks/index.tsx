'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Space } from 'antd';
import { useEditedDataset } from '@/components/EditedDataset';

export const StatisticsLinks = () => {
  const locale = useLocale();
  const t = useTranslations('statistics');
  const query = useSearchParams();
  const { edited } = useEditedDataset();
  const dataset = query.get('dataset') || edited?.name;
  const suffix = dataset ? `?${new URLSearchParams({ dataset })}` : '';
  return (
    <nav aria-label={t('dataset_navigation')}>
      <Space wrap>
        <Link prefetch={false} href={`/${locale}/statistics/datasets`}>
          {t('all_datasets')}
        </Link>
        {(['common', 'translations', 'issues'] as const).map((page) => (
          <Link key={page} prefetch={false} href={`/${locale}/statistics/${page}${suffix}`}>
            {t(`${page}_statistics`)}
          </Link>
        ))}
      </Space>
    </nav>
  );
};
