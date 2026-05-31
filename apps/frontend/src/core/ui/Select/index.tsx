import React from 'react';
import { Select as AntdSelect, SelectProps as AntdSelectProps, Typography } from 'antd';
import styles from './styles.module.scss';

const { Text } = Typography;

type SelectP<T = unknown> = {
  label?: string;
} & AntdSelectProps<T>;

export const Select = <T = unknown,>({ label, ...props }: SelectP<T>) => {
  if (!label) {
    return <AntdSelect<T> {...props} />;
  }
  return (
    <div className={styles.select}>
      <Text type={props.status === 'error' ? 'danger' : undefined} strong>
        {label}
      </Text>
      <AntdSelect<T> {...props} />
    </div>
  );
};
