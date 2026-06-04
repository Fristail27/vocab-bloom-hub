import React from 'react';
import { Select as AntdSelect, SelectProps as AntdSelectProps, Typography } from 'antd';
import styles from './styles.module.scss';
import clsx from 'clsx';

const { Text } = Typography;

type SelectP<T = unknown> = {
  label?: string | undefined;
  containerClassName?: string | undefined;
} & AntdSelectProps<T>;

export const Select = <T = unknown,>({ label, containerClassName, ...props }: SelectP<T>) => {
  if (!label) {
    return <AntdSelect<T> {...props} />;
  }
  return (
    <div className={clsx(styles.select, containerClassName)}>
      <Text type={props.status === 'error' ? 'danger' : undefined} strong>
        {label}
      </Text>
      <AntdSelect<T> {...props} />
    </div>
  );
};
