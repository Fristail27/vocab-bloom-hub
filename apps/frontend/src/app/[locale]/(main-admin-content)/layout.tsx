import React from 'react';
import type { Metadata } from 'next';
import { SideMenu } from '@/components/SideMenu';
import { AutoImportBanner } from '@/components/AutoImportBanner';
import { UpdateNotice } from '@/components/UpdateNotice';
import { EditedDatasetBlock } from '@/components/EditedDataset/EditedDatasetBlock';
import { getServerDataset } from '@/core/api/AbstractBaseApi/ServerWrapper';
import { getUpdateCheck } from '@/helpers/getUpdateCheck';
import styles from './styles.module.scss';

export const metadata: Metadata = {
  description: 'The administration panel of this Vocab Bloom Hub instance.',
};

type RootLayoutP = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutP) {
  const update = await getUpdateCheck();
  // another dataset chosen in the switch, another page: what the page read of the previous one is dropped (issue #540)
  const dataset = (await getServerDataset()) ?? '';

  return (
    <>
      <SideMenu />
      <div className={styles.mainContent}>
        {/* .mainContent is a flex row; the banner must sit above the page, not beside it */}
        <div className={styles.mainColumn}>
          {/* the automatic dictionary load on first start, its failure, or an import from another session (issue #268) */}
          {/* a newer release exists: a notice with the way to upgrade, never an upgrade (issue #477) */}
          <UpdateNotice update={update} />
          <AutoImportBanner />
          {/* what the dataset that is edited is (issue #540) */}
          <EditedDatasetBlock />
          <React.Fragment key={dataset}>{children}</React.Fragment>
        </div>
      </div>
    </>
  );
}
