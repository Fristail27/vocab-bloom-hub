'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dropdown } from 'primereact/dropdown';
import cookies from 'js-cookie';
import { DictionaryOptions } from '@/components/DictionarySwitcher/constants';
import { DictionaryE } from '../../../../server/types';
import styles from './styles.module.scss';

export const DictionarySwitcher: React.FC = () => {
  const defaultValue = DictionaryOptions.find((o) => o.code === DictionaryE.en);
  const [value, setValue] = useState(defaultValue);
  const t = useTranslations('common');

  useEffect(() => {
    const v = cookies.get('dictionary');
    if (!v) {
      cookies.set('dictionary', DictionaryE.en);
    } else {
      setValue(DictionaryOptions.find((o) => o.code === v));
    }
  }, []);

  return (
    <div className={styles.dictionarySelect}>
      <span>{t('dictionary')}</span>
      <Dropdown
        value={value}
        onChange={(e) => setValue(e.value)}
        options={DictionaryOptions}
        placeholder={t('dictionary')}
        optionLabel="name"
      />
    </div>
  );
};
