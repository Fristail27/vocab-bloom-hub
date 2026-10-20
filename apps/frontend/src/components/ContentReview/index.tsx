'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Space, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import type { EnWordT } from 'server/types';
import { ContentReviewT, ReviewScopeE, ReviewStatusE } from 'server/types/reviews';
import { reviewContent } from 'server/core/utils/content_review';
import { EnApi } from '@/core/api/EnApi';

const keyOf = (scope: ReviewScopeE, id: number) => `${scope}:${id}`;
type ReviewContextT = {
  dataset: string | undefined;
  reviews: Map<string, ContentReviewT>;
  expected: Map<string, string>;
  update: (review: ContentReviewT) => void;
};
const ReviewContext = createContext<ReviewContextT | null>(null);

/** One read for a card; content-only dependency avoids refetching for provenance or review changes. */
export function ContentReviewProvider({
  word,
  enabled,
  dataset,
  children,
}: React.PropsWithChildren<{
  word: EnWordT;
  enabled: boolean;
  dataset?: string | undefined;
}>) {
  const t = useTranslations('content_review');
  const [reviews, setReviews] = useState(new Map<string, ContentReviewT>());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const expected = new Map<string, string>();
  for (const meaning of word.meanings) {
    expected.set(
      keyOf(ReviewScopeE.definition, meaning.id),
      reviewContent(ReviewScopeE.definition, word, meaning),
    );
    for (const translation of meaning.translations)
      expected.set(
        keyOf(ReviewScopeE.meaning_translation, translation.id),
        reviewContent(ReviewScopeE.meaning_translation, word, translation, meaning),
      );
  }
  for (const translation of word.short_translations)
    expected.set(
      keyOf(ReviewScopeE.short_translation, translation.id),
      reviewContent(ReviewScopeE.short_translation, word, translation),
    );
  const signature = JSON.stringify([...expected]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setReviews(new Map());
    setFailed(false);
    void EnApi.wordReviews(word.id, dataset).then((result) => {
      if (cancelled) return;
      if ('error' in result) setFailed(true);
      else setReviews(new Map(result.map((review) => [keyOf(review.scope, review.id), review])));
    });
    return () => {
      cancelled = true;
    };
  }, [word.id, signature, enabled, dataset, attempt]);
  const update = (review: ContentReviewT) =>
    setReviews((previous) => new Map(previous).set(keyOf(review.scope, review.id), review));
  return (
    <ReviewContext.Provider value={enabled ? { reviews, expected, update, dataset } : null}>
      {enabled && <p>{t('intro')}</p>}
      {enabled && failed && (
        <Alert
          type="error"
          title={t('load_error')}
          action={<Button onClick={() => setAttempt((n) => n + 1)}>{t('retry')}</Button>}
        />
      )}
      {children}
    </ReviewContext.Provider>
  );
}

export function ContentReview({ scope, id }: { scope: ReviewScopeE; id: number }) {
  const context = useContext(ReviewContext);
  const t = useTranslations('content_review');
  const errors = useTranslations('errors');
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const current = useRef(context);
  current.current = context;
  if (!context) return null;
  const key = keyOf(scope, id);
  const review = context.reviews.get(key);
  const expected = context.expected.get(key);
  const stale = !!review && review.expected !== expected;
  const set = async (checked: boolean) => {
    if (busy || !review || !expected) return;
    setBusy(true);
    try {
      const result = await EnApi.setContentReview(scope, id, { checked, expected }, context.dataset);
      if ('error' in result) message.error(errors(result.message));
      else if (current.current?.expected.get(key) === expected) current.current.update(result);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Space wrap role="group" aria-label={t(scope)}>
      <span>{t(scope)}:</span>
      {!review ? (
        <span>{t('loading')}</span>
      ) : stale ? (
        <span role="status">{t('stale')}</span>
      ) : (
        <Tag
          color={
            review.status === ReviewStatusE.checked
              ? 'success'
              : review.status === ReviewStatusE.changed
                ? 'warning'
                : 'default'
          }
        >
          {t(review.status)}
        </Tag>
      )}
      {review && review.status !== ReviewStatusE.checked && (
        <Button size="small" disabled={stale} loading={busy} onClick={() => void set(true)}>
          {t(review.status === ReviewStatusE.changed ? 'recheck' : 'check')}
        </Button>
      )}
      {review && review.status !== ReviewStatusE.unchecked && (
        <Button size="small" disabled={busy} onClick={() => void set(false)}>
          {t('clear')}
        </Button>
      )}
    </Space>
  );
}
