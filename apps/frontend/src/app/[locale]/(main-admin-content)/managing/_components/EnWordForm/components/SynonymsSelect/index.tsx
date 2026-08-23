'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spin, Typography } from 'antd';
import { Select } from '@/core/ui/Select';
import { EnApi } from '@/core/api/EnApi';
import { useDebounced } from '@/core/hooks';
import { EnWordFormsE } from 'server/types';
import styles from './styles.module.scss';

const { Text } = Typography;

type SynonymsSelectP = {
  value: string[];
  onChange: (value: string[]) => void;
  // The meaning's own headword is never offered as its synonym
  headword?: string | undefined;
  containerClassName?: string | undefined;
};

/**
 * Multi-select over existing dictionary entries: synonyms are stored as links
 * to words, so only words the dictionary already has can be picked. Options
 * come from the search endpoint as the admin types.
 */
export const SynonymsSelect: React.FC<SynonymsSelectP> = ({
  value,
  onChange,
  headword,
  containerClassName,
}) => {
  const t = useTranslations('en_managing_words');
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounced(search.trim().toLowerCase(), 300);

  useEffect(() => {
    // a cleared search keeps the last result set, so several words from the
    // same search can be picked one after another
    if (!debouncedSearch) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await EnApi.search(debouncedSearch);
      if (cancelled) return;
      setLoading(false);
      // only base-form entries qualify as synonyms: inflected forms the search
      // may return on their own ("dashed", "ran") are dropped
      setFound(
        'error' in res
          ? []
          : [...new Set(res.filter((w) => w.form_of_word === EnWordFormsE.base_form).map((w) => w.word))],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const self = headword?.trim().toLowerCase();
  const options = useMemo(
    () => found.filter((w) => w !== self).map((w) => ({ value: w, label: w })),
    [found, self],
  );

  return (
    <Select<string[]>
      label={t('synonyms')}
      containerClassName={containerClassName ?? styles.synonymsSelect}
      mode="multiple"
      showSearch
      filterOption={false}
      searchValue={search}
      onSearch={setSearch}
      value={value}
      onChange={(v) => {
        onChange(v);
        setSearch('');
      }}
      options={options}
      loading={loading}
      placeholder={t('synonyms_placeholder')}
      notFoundContent={
        loading ? (
          <Spin size="small" />
        ) : search.trim() ? (
          <Text type="secondary">{t('synonym_not_found')}</Text>
        ) : null
      }
    />
  );
};
