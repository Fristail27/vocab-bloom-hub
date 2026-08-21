'use client';

import React from 'react';
import { Button } from 'antd';
import { useTranslations } from 'next-intl';
import { EnAreaVariantsE, EnPartOfSpeechE, LanguageRegisterE, WordLevelE } from 'server/types';
import { MeaningsFilterT } from '../../types';
import { DebouncedInput, EnumMultiSelect, enumOptions, TriStateSelect } from './shared';
import styles from './styles.module.scss';

type MeaningsFiltersP = {
  value: MeaningsFilterT;
  onChange: (next: MeaningsFilterT) => void;
};

export const MeaningsFilters: React.FC<MeaningsFiltersP> = ({ value, onChange }) => {
  const t = useTranslations('bulk_request');
  const tWords = useTranslations('en_managing_words');
  const [resetKey, setResetKey] = React.useState(0);

  const patch = (next: Partial<MeaningsFilterT>) => onChange({ ...value, ...next });
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
        <EnumMultiSelect<EnAreaVariantsE>
          label={t('filter_area_variant')}
          value={value.area_variant}
          onChange={(area_variant) => patch({ area_variant })}
          options={Object.values(EnAreaVariantsE).map((v) => ({ value: v, label: tWords(`regional_${v}`) }))}
        />
        <EnumMultiSelect<WordLevelE>
          label={t('filter_meaning_level')}
          value={value.meaning_level}
          onChange={(meaning_level) => patch({ meaning_level })}
          options={enumOptions(Object.values(WordLevelE))}
        />
        <EnumMultiSelect<LanguageRegisterE>
          label={t('filter_language_register')}
          value={value.language_register}
          onChange={(language_register) => patch({ language_register })}
          options={Object.values(LanguageRegisterE).map((v) => ({ value: v, label: tWords(`register_${v}`) }))}
        />
      </div>
      <div className={styles.row}>
        <TriStateSelect
          label={t('filter_is_obsolete')}
          value={value.is_obsolete}
          onChange={(is_obsolete) => patch({ is_obsolete })}
        />
        <TriStateSelect
          label={t('filter_has_translations')}
          value={value.has_translations}
          onChange={(has_translations) => patch({ has_translations })}
        />
        <Button onClick={reset} className={styles.reset}>
          {t('reset_filters')}
        </Button>
      </div>
    </div>
  );
};
