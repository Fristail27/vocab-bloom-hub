'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Dropdown } from 'primereact/dropdown';
import React from 'react';

import { InterfaceLanguageOptions } from '@/components/LanguageSwitch/constants';

export const LanguageSwitch: React.FC = () => {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Dropdown
      value={InterfaceLanguageOptions.find((o) => o.code === locale)}
      onChange={(e) => {
        const next = pathname.replace(`/${locale}`, `/${e.value.code}`);
        router.push(next);
      }}
      options={InterfaceLanguageOptions}
      optionLabel="name"
      placeholder="Select a language"
    />
  );
};
