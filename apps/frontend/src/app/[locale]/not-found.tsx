import React from 'react';
import { Result } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';

// Shown for notFound() calls below the [locale] layout (e.g. a missing word id)
export default function NotFound() {
  const t = useTranslations('common');
  const locale = useLocale();

  return (
    <Result
      status="404"
      title={t('page_not_found')}
      subTitle={t('page_not_found_desc')}
      extra={<Link href={`/${locale}`}>{t('go_home')}</Link>}
    />
  );
}
