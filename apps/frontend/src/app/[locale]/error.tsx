'use client';

import React, { useEffect } from 'react';
import { Button, Result } from 'antd';
import { useTranslations } from 'next-intl';

type ErrorBoundaryP = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Route-level error boundary: shown instead of a blank screen when a page
// or a server component below the [locale] layout throws during render
export default function ErrorBoundary({ error, reset }: ErrorBoundaryP) {
  const t = useTranslations('common');

  useEffect(() => {
    // eslint-disable-next-line no-console -- the boundary must not swallow the original error
    console.error(error);
  }, [error]);

  return (
    <Result
      status="error"
      title={t('something_went_wrong')}
      subTitle={t('error_boundary_desc')}
      extra={
        <Button type="primary" onClick={reset}>
          {t('try_again')}
        </Button>
      }
    />
  );
}
