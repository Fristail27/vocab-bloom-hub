import React from 'react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('not_found');

  return (
    <div className="container">
      <h1>{t('title')}</h1>
      <p>{t('text')}</p>
      <Link href="/" className="button">
        {t('home')}
      </Link>
    </div>
  );
}
