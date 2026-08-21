'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
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
