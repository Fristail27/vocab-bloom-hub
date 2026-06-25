'use client';

import React, { ReactNode } from 'react';
import { Card, Button } from 'antd';
import styles from './styles.module.scss';

type MainSectionP = {
  title: string;
  buttons: Array<{ href: string; text: ReactNode; type: React.ComponentProps<typeof Button>['type'] }>;
};

export const MainSection: React.FC<MainSectionP> = ({ title, buttons }) => {
  return (
    <Card title={title} className={styles.mainSection}>
      {buttons.map(({ href, text, type }) => (
        <Button key={href} type={type} href={href}>
          {text}
        </Button>
      ))}
    </Card>
  );
};
