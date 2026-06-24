'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { EnEntryTypesE } from 'server/types';
import { optionRender } from '@/core/ui/Select/utils';
import { Select } from '@/core/ui/Select';
import { getEntityTypeOptions } from './utils';

type EntityTypeSelectP = {
  value: EnEntryTypesE | null;
  onChange: (v: EnEntryTypesE) => void;
  containerClassName?: string | undefined;
};

export const EntityTypeSelect: React.FC<EntityTypeSelectP> = ({ value, onChange, containerClassName }) => {
  const t = useTranslations('en_managing_words');
  const options = getEntityTypeOptions(t);
  return (
    <Select
      showSearch={false}
      containerClassName={clsx(containerClassName)}
      options={options}
      optionRender={optionRender}
      value={value}
      onChange={onChange}
      style={{ width: 156 }}
      label={t('entry_type')}
    />
  );
};
