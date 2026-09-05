'use client';

import React from 'react';
import { Button } from 'antd';
import { useTranslations } from 'next-intl';
import { AvailableTranslationLanguagesE, EnPartOfSpeechE } from 'server/types';
import { ShortTranslationsFilterT } from '../../types';
import { DebouncedInput, EnumMultiSelect, enumOptions } from './shared';
import styles from './styles.module.scss';

type ShortTranslationsFiltersP = {
  value: ShortTranslationsFilterT;
  onChange: (next: ShortTranslationsFilterT) => void;
};

export const ShortTranslationsFilters: React.FC<ShortTranslationsFiltersP> = ({ value, onChange }) => {
  const t = useTranslations('bulk_request');
  const [resetKey, setResetKey] = React.useState(0);

  const patch = (next: Partial<ShortTranslationsFilterT>) => onChange({ ...value, ...next });
  const reset = () => {
    setResetKey((k) => k + 1);
    onChange({});
  };

  return (
    <div className={styles.filters}>
      <div className={styles.row}>
        <DebouncedInput
          key={`search-${resetKey}`}
          label={t('filter_search')}
          value={value.search}
          onCommit={(search) => patch({ search })}
          testId="filter-search"
        />
        <EnumMultiSelect<EnPartOfSpeechE>
          label={t('filter_part_of_speech')}
          value={value.part_of_speech}
          onChange={(part_of_speech) => patch({ part_of_speech })}
          options={enumOptions(Object.values(EnPartOfSpeechE))}
          wide
        />
        <EnumMultiSelect<AvailableTranslationLanguagesE>
          label={t('filter_language')}
          value={value.language}
          onChange={(language) => patch({ language })}
          options={enumOptions(Object.values(AvailableTranslationLanguagesE))}
        />
        <Button onClick={reset} className={styles.reset}>
          {t('reset_filters')}
        </Button>
      </div>
    </div>
  );
};
