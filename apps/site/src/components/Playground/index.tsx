'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  curlOf,
  FieldControlE,
  FieldT,
  initialValues,
  missingRequired,
  planRequest,
  PlaygroundEndpointT,
  ValuesT,
} from '@/content/playground';
import { browserApiBase } from '@/core/apiBase';

import styles from './styles.module.scss';

type ResultT = {
  status: number | null;
  ok: boolean;
  elapsedMs: number;
  body: string;
  requestId?: string | null;
  error?: string;
};

type PlaygroundP = { endpoints: PlaygroundEndpointT[] };

const format = (text: string): string => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

/** Every public endpoint as a form; the request goes to the instance this site is served next to */
export const Playground = ({ endpoints }: PlaygroundP) => {
  const t = useTranslations('playground');
  const searchParams = useSearchParams();
  const requested = searchParams.get('endpoint');
  const [slug, setSlug] = useState<string>(
    () => endpoints.find((endpoint) => endpoint.slug === requested)?.slug ?? endpoints[0].slug,
  );
  const endpoint = endpoints.find((candidate) => candidate.slug === slug) ?? endpoints[0];
  const [values, setValues] = useState<ValuesT>(() => initialValues(endpoint.fields));
  const [result, setResult] = useState<ResultT | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiBase, setApiBase] = useState('/api');

  // the base URL may be relative: resolved against the page origin once mounted
  useEffect(() => setApiBase(browserApiBase()), []);

  const select = (next: PlaygroundEndpointT) => {
    setSlug(next.slug);
    setValues(initialValues(next.fields));
    setResult(null);
  };

  const plan = useMemo(() => planRequest(endpoint, values), [endpoint, values]);
  const missing = missingRequired(endpoint, values);
  const setValue = (name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value }));

  const send = async () => {
    setIsLoading(true);
    const startedAt = performance.now();
    try {
      const res = await fetch(`${apiBase}${plan.path}${plan.query}`, {
        method: plan.method,
        headers: plan.body ? { 'Content-Type': 'application/json' } : undefined,
        body: plan.body ? JSON.stringify(plan.body) : undefined,
      });
      const text = await res.text();
      setResult({
        status: res.status,
        ok: res.ok,
        elapsedMs: Math.round(performance.now() - startedAt),
        body: format(text),
        requestId: res.headers.get('x-request-id'),
      });
    } catch (error) {
      setResult({
        status: null,
        ok: false,
        elapsedMs: Math.round(performance.now() - startedAt),
        body: '',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderField = (field: FieldT) => {
    const value = values[field.name];
    const label = (
      <label htmlFor={`field-${field.name}`}>
        {field.name}
        {field.required && <span className={styles.required}>*</span>}
      </label>
    );

    switch (field.control) {
      case FieldControlE.boolean:
        return (
          <div key={field.name} className={`${styles.field} ${styles.checkbox}`}>
            <input
              id={`field-${field.name}`}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => setValue(field.name, e.target.checked)}
            />
            {label}
          </div>
        );
      case FieldControlE.number:
        return (
          <div key={field.name} className={styles.field}>
            {label}
            <input
              id={`field-${field.name}`}
              type="number"
              min={field.min}
              max={field.max}
              value={value === undefined || value === null ? '' : String(value)}
              onChange={(e) => setValue(field.name, e.target.value === '' ? '' : Number(e.target.value))}
            />
            {field.description && <small>{field.description}</small>}
          </div>
        );
      case FieldControlE.select:
        return (
          <div key={field.name} className={styles.field}>
            {label}
            <select
              id={`field-${field.name}`}
              value={String(value ?? '')}
              onChange={(e) => setValue(field.name, e.target.value)}
            >
              <option value="">—</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {field.description && <small>{field.description}</small>}
          </div>
        );
      case FieldControlE.multi: {
        const selected = new Set(Array.isArray(value) ? (value as string[]) : []);

        return (
          <div key={field.name} className={styles.field}>
            {label}
            <div className={styles.options}>
              {field.options?.map((option) => (
                <label key={option}>
                  <input
                    type="checkbox"
                    checked={selected.has(option)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(option);
                      else next.delete(option);
                      setValue(field.name, [...next]);
                    }}
                  />
                  {option}
                </label>
              ))}
            </div>
            {field.description && <small>{field.description}</small>}
          </div>
        );
      }
      default:
        return (
          <div key={field.name} className={styles.field}>
            {label}
            <input
              id={`field-${field.name}`}
              type="text"
              value={String(value ?? '')}
              onChange={(e) => setValue(field.name, e.target.value)}
            />
            {field.description && <small>{field.description}</small>}
          </div>
        );
    }
  };

  return (
    <div className={styles.layout}>
      <nav className={styles.list} aria-label={t('endpoints')}>
        {endpoints.map((candidate) => (
          <button
            key={candidate.slug}
            type="button"
            className={candidate.slug === endpoint.slug ? styles.active : undefined}
            onClick={() => select(candidate)}
          >
            <span className={`${styles.method} ${styles[candidate.method.toLowerCase()] ?? ''}`}>
              {candidate.method}
            </span>
            <code>{candidate.path.replace(/^\/api\/v1/, '')}</code>
          </button>
        ))}
      </nav>

      <div className={styles.panel}>
        <h2 className={styles.title}>
          <span className={`${styles.method} ${styles[endpoint.method.toLowerCase()] ?? ''}`}>
            {endpoint.method}
          </span>
          <span>{endpoint.path}</span>
        </h2>
        {endpoint.summary && <p className={styles.summary}>{endpoint.summary}</p>}

        {endpoint.fields.length > 0 && <div className={styles.fields}>{endpoint.fields.map(renderField)}</div>}

        <div className={styles.actions}>
          <button type="button" onClick={send} disabled={isLoading || missing.length > 0}>
            {isLoading ? t('sending') : t('send')}
          </button>
          {missing.length > 0 && <span>{t('fill_required', { fields: missing.join(', ') })}</span>}
        </div>

        <div className={styles.block}>
          <h4>{t('request')}</h4>
          <pre className={styles.pre}>{curlOf(plan, apiBase)}</pre>
        </div>

        <div className={styles.block}>
          <h4>{t('response')}</h4>
          {result ? (
            <>
              <div className={styles.status}>
                {result.status !== null && (
                  <strong className={result.ok ? undefined : styles.error}>{result.status}</strong>
                )}
                <span>{t('elapsed', { ms: result.elapsedMs })}</span>
                {result.requestId && <span>x-request-id: {result.requestId}</span>}
                {result.error && (
                  <span className={styles.error}>{t('network_error', { error: result.error })}</span>
                )}
              </div>
              {result.body && <pre className={styles.pre}>{result.body}</pre>}
            </>
          ) : (
            <p className={styles.summary}>{t('no_response')}</p>
          )}
        </div>
      </div>
    </div>
  );
};
