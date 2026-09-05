'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { Card, Button } from 'antd';
import styles from './styles.module.scss';

type MainSectionP = {
  title: string;
  buttons: Array<{ href: string; text: ReactNode; type: React.ComponentProps<typeof Button>['type'] }>;
};

export const MainSection: React.FC<MainSectionP> = ({ title, buttons }) => {
  return (
    <Card title={title} className={styles.mainSection}>
      {/* client-side navigation (issues #348, #405): an antd href button renders a
          plain <a> and reloads the document, re-running the RSC layout per click */}
      {buttons.map(({ href, text, type }) => (
        <Link key={href} href={href}>
          <Button type={type}>{text}</Button>
        </Link>
      ))}
    </Card>
  );
};
