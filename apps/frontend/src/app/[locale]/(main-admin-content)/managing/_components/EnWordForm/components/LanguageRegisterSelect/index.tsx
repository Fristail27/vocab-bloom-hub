'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { optionRender } from '@/core/ui/Select/utils';
import { Select } from '@/core/ui/Select';
import { LanguageRegisterE } from 'server/types';
import { getLanguageRegisterOptions } from './utils';

type LanguageRegisterSelectP = {
  value: LanguageRegisterE;
  onChange: (v: LanguageRegisterE) => void;
};
export const LanguageRegisterSelect: React.FC<LanguageRegisterSelectP> = ({ value, onChange }) => {
  const t = useTranslations('en_managing_words');
  const options = getLanguageRegisterOptions(t);
  return (
    <Select
      style={{ width: 168 }}
      options={options}
      optionRender={optionRender}
      value={value}
      onChange={onChange}
      label={t('register')}
    />
  );
};
