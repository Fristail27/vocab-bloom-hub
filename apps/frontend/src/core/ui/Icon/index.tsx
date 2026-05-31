import React from 'react';
import clsx from 'clsx';
import type { IconP } from './types';
import icons from '../icons';
import styles from './styles.module.scss';

export const Icon: React.FC<IconP> = ({ size = 'small', className, name, width, height }) => {
  const CurrentIcon = icons[name];
  return (
    <CurrentIcon
      width={width}
      height={height}
      className={clsx(!(width || height) && styles[`iconSize__${size}`], className)}
    />
  );
};
