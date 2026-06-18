'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { optionRender } from '@/core/ui/Select/utils';
import { Select } from '@/core/ui/Select';
import { WordLevelE } from 'server/types';
import { WordLevelOptions } from './constants';

type WordLevelSelectP = {
  value: WordLevelE | null;
  onChange: (v: WordLevelE) => void;
};
export const WordLevelSelect: React.FC<WordLevelSelectP> = ({ value, onChange }) => {
  const t = useTranslations('en_managing_words');
  return (
    <Select
      style={{ width: 104 }}
      options={WordLevelOptions}
      optionRender={optionRender}
      value={value}
      onChange={onChange}
      label={t('level')}
    />
  );
};
