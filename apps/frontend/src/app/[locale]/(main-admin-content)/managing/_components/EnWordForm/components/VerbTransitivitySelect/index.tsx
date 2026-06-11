'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Select } from '@/core/ui/Select';
import { EnVerbTransitivityE } from 'server/types';
import { getVerbTransitivityOptions } from './utils';

type VerbTransitivitySelectP = {
  value: EnVerbTransitivityE | undefined | null;
  onChange: (v: EnVerbTransitivityE) => void;
};

export const VerbTransitivitySelect: React.FC<VerbTransitivitySelectP> = ({ value, onChange }) => {
  const t = useTranslations('en_managing_words');
  const options = getVerbTransitivityOptions(t);
  return (
    <Select
      style={{ width: 242 }}
      options={options}
      value={value}
      onChange={onChange}
      label={t('verb_transitivity')}
    />
  );
};
