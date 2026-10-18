import React from 'react';
import { Button, Input, InputNumber, Switch } from 'antd';
import { useTranslations } from 'next-intl';
import { isOriginMetadataField } from 'server/core/utils/reconciliation_content';
import type { ReconciliationSideT, ReconciliationValueT } from 'server/types/reconciliation';
import styles from './styles.module.scss';

export const opaque = (key: string) => /^[\da-f]{8}-[\da-f-]{27}$/i.test(key);

export function useFieldLabel() {
  const fields = useTranslations('en_managing_words');
  const aliases: Record<string, string> = {
    common: 'basic_information',
    meanings: 'word_meanings',
    forms: 'word_forms',
    translations: 'meaning_translations',
    pronunciations: 'pronunciation',
    title: 'short_meaning',
  };
  return (key: string) => {
    const label = aliases[key] ?? key;
    return fields.has(label) ? fields(label) : key.replaceAll('_', ' ');
  };
}

export function recordOptions(side?: ReconciliationSideT): [string, ReconciliationValueT][] {
  if (!side?.present || !side.value || typeof side.value !== 'object' || Array.isArray(side.value)) return [];
  const entries = Object.entries(side.value);
  return entries.every(([key]) => opaque(key)) ? entries : [];
}

export function contextTitle(side: ReconciliationSideT | undefined, path: string[]): string {
  if (!side?.present) return '';
  let value = side.value;
  const labels: string[] = [];
  for (const key of path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) break;
    value = value[key];
    if (opaque(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      const label = value.title || value.word || value.description || value.text || value.language;
      if (typeof label === 'string') labels.push(label);
    }
  }
  return labels.join(' › ');
}

export function Value({
  value,
  change,
  path = [],
}: {
  value: ReconciliationValueT;
  change?: (value: ReconciliationValueT) => void;
  path?: string[];
}) {
  const t = useTranslations('reconciliation');
  const fieldLabel = useFieldLabel();
  if (typeof value === 'string')
    return change ? (
      <Input.TextArea
        aria-label={t('result')}
        value={value}
        onChange={(event) => change(event.target.value)}
        autoSize
      />
    ) : (
      <span className={styles.text}>{value || '—'}</span>
    );
  if (typeof value === 'boolean')
    return change ? (
      <Switch aria-label={t('result')} checked={value} onChange={change} />
    ) : (
      <span>{t(value ? 'yes' : 'no')}</span>
    );
  if (typeof value === 'number')
    return change ? (
      <InputNumber aria-label={t('result')} value={value} onChange={(next) => change(next)} />
    ) : (
      <span>{value}</span>
    );
  if (value === null)
    return change ? (
      <Input.TextArea
        aria-label={t('result')}
        value=""
        onChange={(event) => change(event.target.value || null)}
        autoSize
      />
    ) : (
      <span>—</span>
    );
  if (Array.isArray(value))
    return (
      <div className={styles.values}>
        {value.map((item, index) => (
          <div key={index} className={styles.value}>
            <Value
              value={item}
              path={[...path, String(index)]}
              {...(change && {
                change: (next: ReconciliationValueT) =>
                  change(value.map((old, i) => (i === index ? next : old))),
              })}
            />
            {change && (
              <Button size="small" onClick={() => change(value.filter((_, i) => i !== index))}>
                {t('remove')}
              </Button>
            )}
          </div>
        ))}
        {change && value.every((item) => typeof item === 'string') && (
          <Button size="small" onClick={() => change([...value, ''])}>
            {t('add')}
          </Button>
        )}
      </div>
    );
  return (
    <dl className={styles.values}>
      {Object.entries(value)
        .filter(([key]) => !isOriginMetadataField(path, key))
        .map(([key, item]) => (
          <div key={key}>
            {!opaque(key) && <dt>{fieldLabel(key)}</dt>}
            <dd>
              {opaque(key) && change && (
                <Button
                  size="small"
                  onClick={() =>
                    change(Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)))
                  }
                >
                  {t('remove')}
                </Button>
              )}
              <Value
                value={item}
                path={[...path, key]}
                {...(change &&
                  key !== 'origins' && {
                    change: (next: ReconciliationValueT) => change({ ...value, [key]: next }),
                  })}
              />
            </dd>
          </div>
        ))}
    </dl>
  );
}

export const sideValue = (side: ReconciliationSideT, absent: string, path: string[] = []) =>
  side.present ? <Value value={side.value} path={path} /> : <em>{absent}</em>;
