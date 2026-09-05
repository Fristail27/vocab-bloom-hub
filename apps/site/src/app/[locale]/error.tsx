'use client';

import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';

type ErrorBoundaryP = {
  error: Error & { digest?: string };
  retry: () => void;
};

// Route-level error boundary (issue #406): shown instead of Next's bare
// production "Application error" screen when a page or a component below
// the [locale] layout throws during render
export default function ErrorBoundary({ error, retry }: ErrorBoundaryP) {
  const t = useTranslations('error');

  useEffect(() => {
    // eslint-disable-next-line no-console -- the boundary must not swallow the original error
    console.error(error);
  }, [error]);

  return (
    <div className="container">
      <h1>{t('title')}</h1>
      <p>{t('text')}</p>
      <button type="button" className="button" onClick={retry}>
        {t('retry')}
      </button>
    </div>
  );
}
