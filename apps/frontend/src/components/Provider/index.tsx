'use client'
import React, {ReactNode, useEffect} from "react";
import { PrimeReactProvider } from 'primereact/api';
import {usePathname, useRouter} from "next/navigation";

type ProviderP =  {
    children: ReactNode;
    isAuth: boolean;
}

export const Provider: React.FC<ProviderP> = ({ children, isAuth }) => {
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isAuth && pathname !== '/login') {
            router.replace('/login');
        }
    }, [pathname])

    return <PrimeReactProvider>
        {(isAuth || pathname === '/login') && children}
    </PrimeReactProvider>
}