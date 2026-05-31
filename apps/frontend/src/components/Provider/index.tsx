'use client';

import React, { ReactNode, useEffect, useState, useMemo } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { StateContext } from '@/components/StateContext';
import { ThemeE } from '@/types/common';

type ProviderP = {
  children: ReactNode;
  isAuth: boolean;
  theme: ThemeE;
};

export const Provider: React.FC<ProviderP> = ({ children, isAuth: defaultIsAuth, theme: defaultTheme }) => {
  const [isAuth, setIsAuth] = useState(defaultIsAuth);
  const [theme, setTheme] = useState(defaultTheme);
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useParams();
  const state = useMemo(() => ({ isAuth, setIsAuth, theme, setTheme }), [isAuth, theme]);

  useEffect(() => {
    if (!isAuth && pathname !== `/${locale}/login`) {
      router.replace(`/${locale}/login`);
    }
  }, [pathname, locale, isAuth]);

  return (
    <StateContext value={state}>
      <ConfigProvider
        theme={{
          algorithm: theme === ThemeE.dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        {pathname === `/${locale}/login` && children}
        {pathname !== `/${locale}/login` && isAuth && children}
      </ConfigProvider>
    </StateContext>
  );
};
