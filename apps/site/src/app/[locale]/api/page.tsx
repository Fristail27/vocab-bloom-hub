import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { listEndpoints, PUBLIC_SPEC_FILE, schemaAnchor } from '@/content/openapi';
import { loadPublicSpec } from '@/content/openapi.load';
import { REPO_BLOB_URL } from '@/content/repo';
import { pageMeta } from '@/core/site';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from './api.module.scss';
import { Operation, OperationLabelsT } from './_components/Operation';
import { PropertiesTable } from './_components/PropertiesTable';

// the examples name a placeholder instance; the playground runs them for real
export const EXAMPLE_BASE_URL = 'https://your-instance.example/api';

export const generateMetadata = async ({ params }: LocaleParamsP): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'api' });

  return pageMeta(t('title'), t('intro'));
};

export default async function ApiReferencePage({ params }: LocaleParamsP) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('api');

  const spec = loadPublicSpec();
  const endpoints = listEndpoints(spec);
  const schemas = Object.entries(spec.components.schemas);

  const labels: OperationLabelsT = {
    name: t('name'),
    in: t('in'),
    type: t('type'),
    required: t('required'),
    description: t('description'),
    yes: t('yes'),
    no: t('no'),
    default: t('default'),
    range: t('range'),
    enumTitle: t('one_of'),
    parameters: t('parameters'),
    no_parameters: t('no_parameters'),
    request_body: t('request_body'),
    responses: t('responses'),
    example: t('example'),
    try_it: t('try_it'),
  };

  return (
    <div className={`container ${styles.layout}`}>
      <aside className={styles.sidebar}>
        <h4>{t('endpoints')}</h4>
        <ul>
          {endpoints.map((endpoint) => (
            <li key={endpoint.slug}>
              <a href={`#${endpoint.slug}`}>
                <span className={`${styles.method} ${styles[endpoint.method.toLowerCase()] ?? ''}`}>
                  {endpoint.method}
                </span>
                <code>{endpoint.path.replace(/^\/api\/v1/, '')}</code>
              </a>
            </li>
          ))}
        </ul>
        <h4>{t('schemas')}</h4>
        <ul>
          {schemas.map(([name]) => (
            <li key={name}>
              <a href={`#${schemaAnchor(name)}`}>
                <code>{name}</code>
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <div className={styles.content}>
        <h1>{t('title')}</h1>
        <p>{t('intro')}</p>
        <p>{spec.info.description}</p>

        <div className={styles.facts}>
          <div>
            <strong>{t('base_url')}</strong>
            <code>{'https://<instance>/api/v1'}</code>
            <div>{t('base_url_text')}</div>
          </div>
          <div>
            <strong>{t('contract')}</strong>
            <div>
              {t('contract_text')} <code>/api/v1/openapi.json</code>;{' '}
              <a href={`${REPO_BLOB_URL}/${PUBLIC_SPEC_FILE}`}>{t('contract_file')}</a>
            </div>
          </div>
          <div>
            <strong>{t('more')}</strong>
            <div>
              <Link href="/docs/api">{t('more_surfaces')}</Link>
              {' · '}
              <Link href="/docs/sdk/node">{t('more_node')}</Link>
              {' · '}
              <Link href="/docs/sdk/python">{t('more_python')}</Link>
            </div>
          </div>
        </div>

        <h2 className={styles.groupTitle}>{t('endpoints')}</h2>
        {endpoints.map((endpoint) => (
          <Operation
            key={endpoint.slug}
            endpoint={endpoint}
            spec={spec}
            baseUrl={EXAMPLE_BASE_URL}
            labels={labels}
          />
        ))}

        <h2 className={styles.groupTitle}>{t('schemas')}</h2>
        {schemas.map(([name, schema]) => (
          <section key={name} id={schemaAnchor(name)} className={styles.schema}>
            <h3>{name}</h3>
            {schema.description && <p>{schema.description}</p>}
            {schema.enum ? (
              <p>
                {t('one_of')}:{' '}
                {schema.enum.map((value, index) => (
                  <React.Fragment key={value}>
                    {index > 0 && ', '}
                    <code>{value}</code>
                  </React.Fragment>
                ))}
              </p>
            ) : (
              <PropertiesTable schema={schema} labels={labels} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
