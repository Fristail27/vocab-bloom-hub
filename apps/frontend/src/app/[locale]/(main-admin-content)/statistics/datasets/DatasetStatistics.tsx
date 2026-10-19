'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Space, Spin, Tag } from 'antd';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { EnDatasetsStatisticsT, EnStatisticsT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

const counters: (keyof EnStatisticsT['totals'])[] = [
  'entries',
  'words',
  'word_forms',
  'phrases',
  'grammar_patterns',
  'meanings',
  'meaning_translations',
  'short_translations',
];

export const DatasetStatistics = () => {
  const locale = useLocale();
  const t = useTranslations('statistics');
  const datasetsT = useTranslations('datasets');
  const [result, setResult] = useState<EnDatasetsStatisticsT | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    void EnApi.getDatasetsStatistics().then((data) => {
      if (!current) return;
      setLoading(false);
      if ('error' in data) {
        setFailed(true);
        setResult(null);
      } else setResult(data);
    });
    return () => {
      current = false;
    };
  }, [revision]);

  return (
    <>
      <p>{t('all_datasets_explanation')}</p>
      <Space wrap>
        <Button
          aria-label={t('refresh_statistics')}
          loading={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {t('refresh_statistics')}
        </Button>
        {result && (
          <span>{t('statistics_read_at', { time: new Date(result.read_at).toLocaleString(locale) })}</span>
        )}
      </Space>
      {loading ? (
        <div role="status">
          <Spin /> {t('statistics_loading')}
        </div>
      ) : failed ? (
        <Alert type="error" showIcon title={t('statistics_unavailable')} />
      ) : result?.datasets.length === 0 ? (
        <Empty description={t('no_installed_datasets')} />
      ) : (
        <div className={styles.grid}>
          {result?.datasets.map(({ dataset, totals, error, updating }) => (
            <section key={dataset.name} aria-label={dataset.title} data-testid={`statistics-${dataset.name}`}>
              <Card
                title={
                  <span className={styles.title} dir="auto">
                    {dataset.title}
                  </span>
                }
              >
                <Space wrap>
                  <code className={styles.name}>{dataset.name}</code>
                  {dataset.active && <Tag color="green">{datasetsT('status_active')}</Tag>}
                  <Tag>{datasetsT(dataset.is_public ? 'status_public' : 'status_closed')}</Tag>
                </Space>
                <p>
                  {datasetsT('label_version')}: <bdi>{dataset.version ?? '—'}</bdi>
                </p>
                {updating && <Alert type="warning" showIcon title={t('statistics_updating')} />}
                {error ? (
                  <Alert type="error" showIcon title={t(error)} />
                ) : (
                  <dl className={styles.counts}>
                    {counters.map((key) => (
                      <div key={key}>
                        <dt>{t(key)}</dt>
                        <dd>{totals[key].toLocaleString(locale)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <nav aria-label={t('dataset_navigation')}>
                  <Space wrap>
                    {(['common', 'translations', 'issues'] as const).map((page) => (
                      <Link
                        key={page}
                        prefetch={false}
                        href={`/${locale}/statistics/${page}?${new URLSearchParams({ dataset: dataset.name })}`}
                      >
                        {t(`${page}_statistics`)}
                      </Link>
                    ))}
                  </Space>
                </nav>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
};
