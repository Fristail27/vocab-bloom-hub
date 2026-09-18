'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import React from 'react';
import { Select } from 'antd';
import { LabelInValueType } from '@rc-component/select/es/Select';
import { InterfaceLanguageOptions } from '@/components/LanguageSwitch/constants';
import { InterfaceLanguageEnum } from '@/types/common';
import { labelRender, optionRender } from '@/core/ui/Select/utils';
import icons from '@/core/ui/icons';

type LanguageSwitchP = {
  /** Accessible name of the select */
  label?: string;
};

export const LanguageSwitch: React.FC<LanguageSwitchP> = ({ label }) => {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const onChange = (v: InterfaceLanguageEnum) => {
    const next = pathname.replace(`/${locale}`, `/${v}`);
    router.push(next);
  };

  const renderLabel = (o: LabelInValueType) =>
    labelRender(
      o,
      InterfaceLanguageOptions.find((op) => op.value === o.value)?.icons as Array<keyof typeof icons>,
    );

  return (
    <Select
      value={locale as InterfaceLanguageEnum}
      style={{ width: 140 }}
      onChange={onChange}
      aria-label={label}
      options={InterfaceLanguageOptions}
      optionRender={optionRender}
      labelRender={renderLabel}
    />
  );
};
