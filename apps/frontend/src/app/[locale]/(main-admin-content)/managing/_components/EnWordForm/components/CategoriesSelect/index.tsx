'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { optionRender } from '@/core/ui/Select/utils';
import { Select } from '@/core/ui/Select';
import { CategoryE } from 'server/types';
import { getCategoryOptions } from './utils';
import styles from './styles.module.scss';

type CategorySelectP = {
  value: CategoryE[] | null;
  onChange: (v: CategoryE[]) => void;
  containerClassName?: string | undefined;
};

export const CategorySelect: React.FC<CategorySelectP> = ({ value, onChange, containerClassName }) => {
  const t = useTranslations('en_managing_words');
  const options = getCategoryOptions(t);
  return (
    <Select
      showSearch={false}
      containerClassName={clsx(styles.categorySelectCont, containerClassName)}
      mode="multiple"
      options={options}
      optionRender={optionRender}
      value={value || []}
      onChange={onChange}
      label={t('domain')}
    />
  );
};
