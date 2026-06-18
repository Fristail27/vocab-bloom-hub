'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { labelRender, optionRender } from '@/core/ui/Select/utils';
import { Select } from '@/core/ui/Select';
import { AvailableTranslationLanguagesE } from 'server/types';
import { getTranslationsOptions } from './utils';

type LanguageRegisterSelectP = {
  value: AvailableTranslationLanguagesE;
  onChange: (v: AvailableTranslationLanguagesE) => void;
  disabled?: boolean | undefined;
};
export const TranslationLanguageSelect: React.FC<LanguageRegisterSelectP> = ({ value, onChange, disabled }) => {
  const t = useTranslations('en_managing_words');
  const options = getTranslationsOptions(t);
  const currentOpt = options.find((o) => o.value === value);
  return (
    <Select
      disabled={disabled}
      style={{ width: 162 }}
      options={options}
      optionRender={optionRender}
      labelRender={(o) => labelRender(o, currentOpt?.icons || [])}
      value={value}
      onChange={onChange}
      label={t('translation_language')}
    />
  );
};
