import React from 'react';
import { Icon } from '@/core/ui/Icon';
import styles from './styles.module.scss';

type BreadcrumbSectionP = {
  name: string;
  icon: React.ComponentProps<typeof Icon>['name'];
};

export const BreadcrumbSection: React.FC<BreadcrumbSectionP> = ({ name, icon }) => {
  return (
    <div className={styles.breadcrumbItem}>
      <Icon name={icon} /> {name}
    </div>
  );
};
