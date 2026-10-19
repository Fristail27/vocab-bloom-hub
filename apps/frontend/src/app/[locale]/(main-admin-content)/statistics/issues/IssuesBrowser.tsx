'use client';

import { useEffect, useState } from 'react';
import { Alert, Card, Empty, Pagination, Spin } from 'antd';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  EN_STATISTICS_ISSUE_KEYS,
  EnIssueRecordsT,
  EnIssuesStatisticsT,
  EnStatisticsIssueKeyT,
} from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { useEditedDataset } from '@/components/EditedDataset';
import { StatisticsError } from '../_components/StatisticsError';
import { DistributionRow } from '../_components/DistributionRow';
import { InterfaceLanguageEnum } from '@/types/common';
import styles from './styles.module.scss';

export const IssuesBrowser = () => {
  const locale = useLocale();
  const t = useTranslations('statistics');
  const query = useSearchParams();
  const router = useRouter();
  const { edited } = useEditedDataset();
  const dataset = query.get('dataset') || edited?.name;
  const category = query.get('category');
  const page = Number(query.get('page') || 1);
  const validCategory = EN_STATISTICS_ISSUE_KEYS.includes(category as EnStatisticsIssueKeyT);
  const validPage = Number.isInteger(page) && page > 0 && page <= 2147483647;
  const [stats, setStats] = useState<EnIssuesStatisticsT | null>(null);
  const [records, setRecords] = useState<EnIssueRecordsT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const href = (name: string, category?: string, page = 1) =>
    `/${locale}/statistics/issues?${new URLSearchParams({ dataset: name, ...(category ? { category, page: String(page) } : {}) })}`;

  useEffect(() => {
    if ((category && !validCategory) || !validPage) return;
    let current = true;
    let revision = 0;
    const refresh = async () => {
      const request = ++revision;
      setLoading(true);
      setError(null);
      // A selected category needs only its own count, not eleven full-dictionary counts.
      const result = category
        ? await EnApi.getIssueRecords({
            ...(dataset ? { dataset } : {}),
            category: category as EnStatisticsIssueKeyT,
            page,
            limit: 25,
          })
        : await EnApi.getIssuesStatistics(dataset);
      if (!current || request !== revision) return;
      setLoading(false);
      if ('error' in result) {
        setError(result.message);
        return;
      }
      const list = 'items' in result ? result : null;
      setStats('issues' in result ? result : null);
      setRecords(list);
      if (!query.get('dataset') || (list && list.page !== page)) {
        const next = new URLSearchParams(query.toString());
        next.set('dataset', result.dataset);
        if (list) next.set('page', String(list.page));
        router.replace(`/${locale}/statistics/issues?${next}`, { scroll: false });
      }
    };
    void refresh();
    // Returning from the editor (including browser back/BFCache) reads current counts and rows.
    const reload = () => {
      void refresh();
    };
    window.addEventListener('pageshow', reload);
    window.addEventListener('focus', reload);
    window.addEventListener('popstate', reload);
    return () => {
      current = false;
      window.removeEventListener('pageshow', reload);
      window.removeEventListener('focus', reload);
      window.removeEventListener('popstate', reload);
    };
  }, [dataset, category, page, validCategory, validPage, query, router, locale]);

  if ((category && !validCategory) || !validPage) return <Alert type="error" title={t('invalid_category')} />;
  if (error) return <StatisticsError locale={locale as InterfaceLanguageEnum} message={error} />;
  if (loading || (!stats && !records)) return <Spin />;
  return (
    <>
      <Alert type="info" showIcon title={t('issues_explanation')} />
      {!category && stats && (
        <Card title={t('issues_title')}>
          {stats.issues.map((issue) => (
            <div key={issue.key} className={styles.category}>
              <DistributionRow
                label={t(issue.key)}
                count={issue.count}
                total={issue.total}
                showPercent
                href={href(stats.dataset, issue.key)}
              />
              <small>{t(`interpretation_${issue.interpretation}`)}</small>
            </div>
          ))}
        </Card>
      )}
      {records && (
        <Card title={t(records.category)} id="matching-records">
          <Link prefetch={false} href={href(records.dataset)}>
            {t('issues_title')}
          </Link>
          <p>
            {t('matching_records', { count: records.total })} · {t(`record_${records.kind}`)}
          </p>
          <p>{t(`interpretation_${records.interpretation}`)}</p>
          {records.items.length === 0 ? (
            <Empty description={t('no_matching_records')} />
          ) : (
            <ul className={styles.records}>
              {records.items.map((record) => {
                const anchor =
                  records.kind === 'meaning'
                    ? `meaning-${record.id}`
                    : records.kind === 'meaning_translation'
                      ? `meaning-translation-${record.id}`
                      : records.kind === 'short_translation'
                        ? `short-translation-${record.id}`
                        : '';
                const context = new URLSearchParams({
                  dataset: records.dataset,
                  category: records.category,
                  page: String(records.page),
                });
                return (
                  <li key={record.id}>
                    <Link
                      prefetch={false}
                      href={`/${locale}/managing/edit-word/${record.word_id}?${context}#${anchor}`}
                    >
                      <b dir="auto">{record.word}</b> · {record.part_of_speech} · {t('open_record')}
                    </Link>
                    {record.meaning_id !== null && (
                      <p dir="auto">
                        {record.meaning_title} — {record.meaning_definition}
                      </p>
                    )}
                    {record.language && (
                      <p dir="auto">
                        {record.language}: {record.text || '—'}
                      </p>
                    )}
                    <small>
                      {t(`record_${records.kind}`)} #{record.id.toLocaleString(locale)}
                    </small>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination
            current={records.page}
            total={records.total}
            pageSize={records.limit}
            showSizeChanger={false}
            onChange={(next) => router.push(href(records.dataset, records.category, next), { scroll: false })}
          />
        </Card>
      )}
    </>
  );
};
