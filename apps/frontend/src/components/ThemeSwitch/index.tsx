'use client';

import cookies from 'js-cookie';
import { useTranslations } from 'next-intl';
import { SelectButton, SelectButtonChangeEvent } from 'primereact/selectbutton';
import React, { useCallback, useState } from 'react';

import { ThemeOptions } from '@/components/ThemeSwitch/constants';
import { getThemeLink } from '@/helpers/getThemeLink';
import { ThemeE } from '@/types/common';

type ThemeSwitchP = {
  theme?: ThemeE | undefined;
};

export const ThemeSwitch: React.FC<ThemeSwitchP> = ({ theme }) => {
  const [selectedTheme, setSelectedTheme] = useState<ThemeE>(theme || (cookies.get('theme') as ThemeE));
  const t = useTranslations('common.theme');

  const changeTheme = useCallback(
    (v: SelectButtonChangeEvent) => {
      if (v.value) {
        setSelectedTheme(v.value);
        cookies.set('theme', v.value);
        const themeLinkEl = document.getElementById('theme-link') as HTMLLinkElement;
        if (themeLinkEl) themeLinkEl.href = getThemeLink(v.value);
      }
    },
    [selectedTheme],
  );

  return (
    <SelectButton
      value={selectedTheme}
      onChange={changeTheme}
      options={ThemeOptions}
      itemTemplate={(option) => t(option.value)}
    />
  );
};
