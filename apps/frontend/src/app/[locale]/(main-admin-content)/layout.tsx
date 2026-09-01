import React from 'react';
import type { Metadata } from 'next';
import { SideMenu } from '@/components/SideMenu';
import { AutoImportBanner } from '@/components/AutoImportBanner';
import styles from './styles.module.scss';

export const metadata: Metadata = {
  description: 'The administration panel of this Vocab Bloom Hub instance.',
};

type RootLayoutP = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutP) {
  return (
    <>
      <SideMenu />
      <div className={styles.mainContent}>
        {/* .mainContent is a flex row; the banner must sit above the page, not beside it */}
        <div className={styles.mainColumn}>
          {/* the automatic dictionary load on first start, its failure, or an import from another session (issue #268) */}
          <AutoImportBanner />
          {children}
        </div>
      </div>
    </>
  );
}
