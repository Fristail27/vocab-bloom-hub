'use client';

import React from 'react';
import clsx from 'clsx';
import { Typography } from 'antd';
import type { TitleProps } from 'antd/es/typography/Title';
import styles from './styles.module.scss';

const { Title: AntdTitle } = Typography;

export const Title = (props: TitleProps) => {
  return <AntdTitle {...props} className={clsx(props.className, styles.title)} />;
};
