'use client';

import React, { ReactNode, useEffect, useState, useMemo } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { PrimeReactProvider } from 'primereact/api';
import { SideMenu } from '@/components/SideMenu';
import { StateContext } from '@/components/StateContext';
import styles from './styles.module.scss';

type ProviderP = {
  children: ReactNode;
  isAuth: boolean;
};

export const Provider: React.FC<ProviderP> = ({
  children,
  isAuth: defaultIsAuth,
}) => {
  const [isAuth, setIsAuth] = useState(defaultIsAuth);
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useParams();
  const state = useMemo(() => ({ isAuth, setIsAuth }), [isAuth]);

  useEffect(() => {
    if (!isAuth && pathname !== `/${locale}/login`) {
      router.replace(`/${locale}/login`);
    }
  }, [pathname, locale, isAuth]);

  return (
    <StateContext value={state}>
      <PrimeReactProvider>
        {pathname === `/${locale}/login` && children}
        {pathname !== `/${locale}/login` && isAuth && (
          <>
            <SideMenu />
            <div className={styles.mainContent}>{children}</div>
          </>
        )}
      </PrimeReactProvider>
    </StateContext>
  );
};
