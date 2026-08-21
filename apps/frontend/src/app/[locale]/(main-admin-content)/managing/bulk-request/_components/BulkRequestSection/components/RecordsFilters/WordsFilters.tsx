'use client';

import React from 'react';
import { Button } from 'antd';
import { useTranslations } from 'next-intl';
import { EnAreaVariantsE, EnPartOfSpeechE, LanguageRegisterE, WordLevelE } from 'server/types';
import { WordsFilterT } from '../../types';
import { DebouncedInput, EnumMultiSelect, enumOptions, TriStateSelect } from './shared';
import styles from './styles.module.scss';

type WordsFiltersP = {
  value: WordsFilterT;
  onChange: (next: WordsFilterT) => void;
};

export const WordsFilters: React.FC<WordsFiltersP> = ({ value, onChange }) => {
  const t = useTranslations('bulk_request');
  const tWords = useTranslations('en_managing_words');
  // remounts the debounced text inputs so a reset clears what is typed in them
  const [resetKey, setResetKey] = React.useState(0);

  const patch = (next: Partial<WordsFilterT>) => onChange({ ...value, ...next });
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
          label={t('filter_word_level')}
          value={value.word_level}
          onChange={(word_level) => patch({ word_level })}
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
          label={t('filter_generated')}
          value={value.generated}
          onChange={(generated) => patch({ generated })}
        />
        <DebouncedInput
          key={`model-${resetKey}`}
          label={t('filter_generated_by_model')}
          value={value.generated_by_model}
          onCommit={(generated_by_model) => patch({ generated_by_model })}
        />
        <DebouncedInput
          key={`version-${resetKey}`}
          label={t('filter_version')}
          value={value.version}
          onCommit={(version) => patch({ version })}
        />
        <TriStateSelect
          label={t('filter_is_obsolete')}
          value={value.is_obsolete}
          onChange={(is_obsolete) => patch({ is_obsolete })}
        />
        <TriStateSelect
          label={t('filter_has_meanings')}
          value={value.has_meanings}
          onChange={(has_meanings) => patch({ has_meanings })}
        />
        <TriStateSelect
          label={t('filter_has_short_translations')}
          value={value.has_short_translations}
          onChange={(has_short_translations) => patch({ has_short_translations })}
        />
        <Button onClick={reset} className={styles.reset}>
          {t('reset_filters')}
        </Button>
      </div>
    </div>
  );
};
