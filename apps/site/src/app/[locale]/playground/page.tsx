import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Playground } from '@/components/Playground';
import { listEndpoints } from '@/content/openapi';
import { loadPublicSpec } from '@/content/openapi.load';
import { playgroundEndpoint } from '@/content/playground';
import { pageMeta } from '@/core/site';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from './playground.module.scss';

export const generateMetadata = async ({ params }: LocaleParamsP): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'playground' });

  return pageMeta(t('title'), t('intro'));
};

export default async function PlaygroundPage({ params }: LocaleParamsP) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('playground');

  // the forms are derived from the committed contract at build time; the
  // OpenAPI document itself is served by the API, not something to fill in
  const spec = loadPublicSpec();
  const endpoints = listEndpoints(spec)
    .filter((endpoint) => !endpoint.path.endsWith('/openapi.json'))
    .map((endpoint) => playgroundEndpoint(endpoint, spec));

  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('title')}</h1>
      <p className={styles.intro}>
        {t('intro')} <Link href="/api">{t('reference_link')}</Link>
      </p>
      <Suspense>
        <Playground endpoints={endpoints} />
      </Suspense>
    </div>
  );
}
