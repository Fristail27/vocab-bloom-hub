'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Pagination, Select, Space, Spin } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { ReviewScopeE, ReviewStatusE, ReviewWordsT } from 'server/types/reviews';
import { EnApi } from '@/core/api/EnApi';
import { useEditedDataset } from '@/components/EditedDataset';
import styles from './styles.module.scss';

function Results({ search }: { search: string }) {
  const t = useTranslations('content_review');
  const locale = useLocale();
  const { edited } = useEditedDataset();
  const dataset = edited?.name;
  const [scope, setScope] = useState(ReviewScopeE.definition);
  const [status, setStatus] = useState(ReviewStatusE.unchecked);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ReviewWordsT | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setPage(1);
  }, [search, dataset]);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setFailed(false);
    void EnApi.reviewWords({ scope, status, search, page, limit: 20 }, dataset).then((response) => {
      if (cancelled) return;
      if ('error' in response) setFailed(true);
      else setResult(response);
    });
    return () => {
      cancelled = true;
    };
  }, [scope, status, search, page, attempt, dataset]);
  return (
    <div className={styles.browser}>
      <p>{t('filter_hint')}</p>
      <Space wrap>
        <Select
          virtual={false}
          aria-label={t('scope')}
          value={scope}
          onChange={(value) => {
            setScope(value);
            setPage(1);
          }}
          options={Object.values(ReviewScopeE).map((value) => ({ value, label: t(value) }))}
        />
        <Select
          virtual={false}
          aria-label={t('status')}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={Object.values(ReviewStatusE).map((value) => ({ value, label: t(value) }))}
        />
        <Button onClick={() => setAttempt((n) => n + 1)}>{t('retry')}</Button>
      </Space>
      {failed ? (
        <Alert type="error" title={t('load_error')} />
      ) : !result ? (
        <Spin aria-label={t('loading')} />
      ) : (
        <>
          <p aria-live="polite">
            {Object.values(ReviewStatusE)
              .map((value) => `${t(value)}: ${result.counts[value]}`)
              .join(' · ')}
          </p>
          {result.items.length === 0 ? (
            <p>{t('empty')}</p>
          ) : (
            <ul>
              {result.items.map((word) => (
                <li key={word.id}>
                  <Link
                    href={`/${locale}/managing/edit-word/${word.id}${dataset ? `?dataset=${encodeURIComponent(dataset)}` : ''}`}
                  >
                    {word.word} ({word.part_of_speech})
                  </Link>
                  {' — '}
                  {t('matches', { count: word.matches })}
                </li>
              ))}
            </ul>
          )}
          <Pagination
            current={page}
            total={result.total}
            pageSize={20}
            showSizeChanger={false}
            onChange={setPage}
            hideOnSinglePage
          />
        </>
      )}
    </div>
  );
}

export function ReviewBrowser({ search }: { search: string }) {
  const t = useTranslations('content_review');
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t('browse')}</summary>
      {open && <Results search={search} />}
    </details>
  );
}
