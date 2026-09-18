'use client';

import React, { useCallback, useContext } from 'react';
import cookies from 'js-cookie';
import { Switch } from 'antd';
import { ThemeE } from '@/types/common';
import { StateContext } from '@/components/StateContext';
import { getThemeVariablesLink } from '@/helpers/getThemeLink';

type ThemeSwitchP = {
  /** Accessible name: the switch shows only an emoji */
  label?: string;
};

export const ThemeSwitch: React.FC<ThemeSwitchP> = ({ label }) => {
  const { theme, setTheme } = useContext(StateContext);

  const changeTheme = useCallback((checked: boolean) => {
    const v = checked ? ThemeE.dark : ThemeE.light;
    setTheme(v);
    cookies.set('theme', v);
    const themeLinkEl = document.getElementById('variables-link') as HTMLLinkElement;
    if (themeLinkEl) themeLinkEl.href = getThemeVariablesLink(v);
  }, []);

  return (
    <Switch
      aria-label={label}
      checked={theme === ThemeE.dark}
      onChange={changeTheme}
      checkedChildren="🌙"
      unCheckedChildren="☀️"
    />
  );
};
