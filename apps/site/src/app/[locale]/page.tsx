import React from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Markdown } from '@/components/Markdown';
import { INSTALL_SNIPPET, NODE_SNIPPET, PYTHON_SNIPPET, readRoadmap } from '@/content/home';
import { renderMarkdown } from '@/content/markdown';
import { REPO_URL } from '@/content/repo';
import { Link } from '@/i18n/navigation';
import { LocaleParamsP } from '@/types/common';

import styles from './home.module.scss';

const FEATURES = ['api', 'sdk', 'admin', 'data', 'ops', 'search'] as const;

const fence = (lang: string, code: string) => `\`\`\`${lang}\n${code}\n\`\`\``;

export default async function HomePage({ params }: LocaleParamsP) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  const roadmap = readRoadmap(locale);
  const [install, node, python, roadmapHtml] = await Promise.all([
    renderMarkdown(fence('bash', INSTALL_SNIPPET), { fromFile: 'README.md', locale }),
    renderMarkdown(fence('ts', NODE_SNIPPET), { fromFile: 'README.md', locale }),
    renderMarkdown(fence('python', PYTHON_SNIPPET), { fromFile: 'README.md', locale }),
    renderMarkdown(roadmap.markdown, { fromFile: roadmap.file, locale }),
  ]);

  return (
    <div className="container">
      <section className={styles.hero}>
        <h1>{t('hero_title')}</h1>
        <p>{t('hero_text')}</p>
        <div className={styles.actions}>
          <Link href="/docs/deployment/docker" className="button primary">
            {t('cta_start')}
          </Link>
          <Link href="/playground" className="button">
            {t('cta_playground')}
          </Link>
          <Link href="/api" className="button">
            {t('cta_api')}
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t('install_title')}</h2>
        <p>{t('install_text')}</p>
        <div className={styles.snippet}>
          <Markdown html={install.html} />
        </div>
        <div className={styles.links}>
          <Link href="/docs/deployment">{t('install_more')} →</Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t('features_title')}</h2>
        <div className={styles.grid}>
          {FEATURES.map((key) => (
            <div key={key} className={styles.card}>
              <h3>{t(`features.${key}_title`)}</h3>
              <p>{t(`features.${key}_text`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t('sdk_title')}</h2>
        <p>{t('sdk_text')}</p>
        <div className={styles.columns}>
          <div className={styles.snippet}>
            <h3>
              <Link href="/docs/sdk/node">{t('sdk_node')}</Link>
            </h3>
            <Markdown html={node.html} />
          </div>
          <div className={styles.snippet}>
            <h3>
              <Link href="/docs/sdk/python">{t('sdk_python')}</Link>
            </h3>
            <Markdown html={python.html} />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t('data_title')}</h2>
        <p>{t('data_text')}</p>
        <div className={styles.links}>
          <Link href="/docs/data">{t('data_link')} →</Link>
          <Link href="/docs/data-license">{t('license_link')} →</Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t('status_title')}</h2>
        <p>{t('status_text')}</p>
      </section>

      <section className={styles.section}>
        <h2>{t('roadmap_title')}</h2>
        <Markdown html={roadmapHtml.html} />
        <div className={styles.links}>
          <a href={`${REPO_URL}/issues`}>{t('roadmap_link')} →</a>
        </div>
      </section>
    </div>
  );
}
