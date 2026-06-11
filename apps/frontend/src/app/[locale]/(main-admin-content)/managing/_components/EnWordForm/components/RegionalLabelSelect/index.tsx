'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { labelRender, optionRender } from '@/core/ui/Select/utils';
import { Select } from '@/core/ui/Select';
import { EnAreaVariantsE } from 'server/types';
import { getRegionalLabelOptions } from './utils';

type RegionalLabelSelectP = {
  value: EnAreaVariantsE;
  width?: number | string | undefined;
  onChange: (v: EnAreaVariantsE) => void;
};
export const RegionalLabelSelect: React.FC<RegionalLabelSelectP> = ({ value, onChange, width }) => {
  const t = useTranslations('en_managing_words');
  const options = getRegionalLabelOptions(t);
  const currentOption = options.find((el) => el.value === value)?.icons || [];
  return (
    <Select
      style={{ width: width || 168 }}
      options={options}
      optionRender={optionRender}
      labelRender={(o) => labelRender(o, currentOption)}
      value={value}
      onChange={onChange}
      label={t('regional_label')}
    />
  );
};
