'use client';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { PrimeReactProvider } from 'primereact/api';
import React, { ReactNode, useEffect } from 'react';

import { SideMenu } from '@/components/SideMenu';

import styles from './styles.module.scss';

type ProviderP = {
  children: ReactNode;
  isAuth: boolean;
};

export const Provider: React.FC<ProviderP> = ({ children, isAuth }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useParams();

  useEffect(() => {
    if (!isAuth && pathname !== '/login') {
      router.replace('/login');
    }
  }, [pathname]);

  return (
    <PrimeReactProvider>
      {pathname === `/${locale}/login` && children}
      {pathname !== `/${locale}/login` && (
        <>
          <SideMenu />
          <div className={styles.mainContent}>{children}</div>
        </>
      )}
    </PrimeReactProvider>
  );
};
