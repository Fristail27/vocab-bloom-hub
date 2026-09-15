'use client';

import React from 'react';
import { AutoComplete, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { EnWordModelItemT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { useDebounced } from '@/core/hooks';
import styles from './styles.module.scss';

type DebouncedInputP = {
  label: string;
  value: string | undefined;
  onCommit: (next: string | undefined) => void;
  testId?: string | undefined;
};

/** Text filter that reports its trimmed value after a pause, not per keystroke */
export const DebouncedInput: React.FC<DebouncedInputP> = ({ label, value, onCommit, testId }) => {
  const [text, setText] = React.useState(value ?? '');
  const debounced = useDebounced(text, 400);

  React.useEffect(() => {
    const next = debounced.trim() || undefined;
    if (next !== value) onCommit(next);
    // only the debounced text may trigger this effect
  }, [debounced]);

  return (
    <Input
      label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      allowClear
      data-testid={testId}
    />
  );
};

type TriStateT = 'any' | 'yes' | 'no';
const toTriState = (v: boolean | undefined): TriStateT => (v === undefined ? 'any' : v ? 'yes' : 'no');
const fromTriState = (v: TriStateT): boolean | undefined => (v === 'any' ? undefined : v === 'yes');

type TriStateSelectP = {
  label: string;
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
};

/** Any / yes / no select for a boolean filter */
export const TriStateSelect: React.FC<TriStateSelectP> = ({ label, value, onChange }) => {
  const t = useTranslations('bulk_request');
  return (
    <Select<TriStateT>
      label={label}
      value={toTriState(value)}
      onChange={(v) => onChange(fromTriState(v))}
      options={[
        { value: 'any', label: t('filter_any') },
        { value: 'yes', label: t('filter_yes') },
        { value: 'no', label: t('filter_no') },
      ]}
      containerClassName={styles.small}
    />
  );
};

type EnumMultiSelectP<T extends string> = {
  label: string;
  value: T[] | undefined;
  options: { value: T; label: string }[];
  onChange: (next: T[] | undefined) => void;
  wide?: boolean;
};

/** Multi-select over an enum; an empty selection means "no filter" */
export const EnumMultiSelect = <T extends string>({
  label,
  value,
  options,
  onChange,
  wide,
}: EnumMultiSelectP<T>) => (
  <Select<T[]>
    label={label}
    mode="multiple"
    allowClear
    value={value ?? []}
    onChange={(next) => onChange(next.length ? next : undefined)}
    options={options}
    containerClassName={wide ? styles.wide : styles.medium}
  />
);

export const enumOptions = <T extends string>(values: T[]) => values.map((v) => ({ value: v, label: v }));

type ModelAutoCompleteP = {
  label: string;
  value: string | undefined;
  onCommit: (next: string | undefined) => void;
  testId?: string | undefined;
};

/**
 * The source-model filter: a text the server matches as a substring, with the
 * labels that exist in the dictionary (and their word counts) offered under
 * it, so the hand-typed spellings of one model are visible and one fragment —
 * "grok" — can be chosen to cover all of them. The labels are loaded once,
 * when the filters are shown.
 */
export const ModelAutoComplete: React.FC<ModelAutoCompleteP> = ({ label, value, onCommit, testId }) => {
  const [text, setText] = React.useState(value ?? '');
  const [models, setModels] = React.useState<EnWordModelItemT[]>([]);
  const debounced = useDebounced(text, 400);

  React.useEffect(() => {
    let cancelled = false;
    EnApi.listWordModels().then((res) => {
      if (!cancelled && !('error' in res)) setModels(res.items.filter((item) => item.model !== null));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const next = debounced.trim() || undefined;
    if (next !== value) onCommit(next);
    // only the debounced text may trigger this effect
  }, [debounced]);

  const needle = text.trim().toLowerCase();
  const options = models
    .filter((item) => !needle || item.model!.toLowerCase().includes(needle))
    .map((item) => ({ value: item.model!, label: `${item.model} (${item.count})` }));

  return (
    <div className={styles.autocomplete}>
      <Typography.Text strong>{label}</Typography.Text>
      <AutoComplete
        value={text}
        options={options}
        onChange={(next: string) => setText(next ?? '')}
        allowClear
        data-testid={testId}
      />
    </div>
  );
};
