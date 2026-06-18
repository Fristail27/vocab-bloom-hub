'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Select } from '@/core/ui/Select';
import { EnPhrasalObjectPatternE } from 'server/types';
import { getPhrasalObjectPatternOptions } from './utils';

type ObjectPatternSelectP = {
  value: EnPhrasalObjectPatternE | undefined | null;
  onChange: (v: EnPhrasalObjectPatternE) => void;
};

export const PhrasalObjectPatternSelect: React.FC<ObjectPatternSelectP> = ({ value, onChange }) => {
  const t = useTranslations('en_managing_words');
  const options = getPhrasalObjectPatternOptions(t);
  return (
    <Select
      style={{ width: 404 }}
      options={options}
      value={value}
      onChange={onChange}
      label={t('verb_phrasal_object_pattern')}
    />
  );
};
