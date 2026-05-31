'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import cookies from 'js-cookie';
import { DictionaryOptions } from '@/components/DictionarySwitcher/constants';
import { DictionaryE } from '../../../../server/types';
import { Select } from '@/core/ui/Select';
import { labelRender, optionRender } from '@/core/ui/Select/utils';
import { LabelInValueType } from '@rc-component/select/es/Select';
import icons from '@/core/ui/icons';

export const DictionarySwitcher: React.FC = () => {
  const [value, setValue] = useState<DictionaryE>(DictionaryE.en);
  const t = useTranslations('common');

  const renderLabel = (o: LabelInValueType) =>
    labelRender(o, DictionaryOptions.find((op) => op.value === o.value)?.icons as Array<keyof typeof icons>);

  useEffect(() => {
    const v = cookies.get('dictionary') as DictionaryE;
    if (!v) {
      cookies.set('dictionary', DictionaryE.en);
    } else {
      setValue(v);
    }
  }, []);

  return (
    <Select<DictionaryE>
      disabled
      label={t('dictionary')}
      value={value}
      onChange={setValue}
      options={DictionaryOptions}
      placeholder={t('dictionary')}
      optionRender={optionRender}
      labelRender={renderLabel}
    />
  );
};
