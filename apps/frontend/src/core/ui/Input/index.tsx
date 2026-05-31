import React from 'react';
import { Input as AntdInput, Typography } from 'antd';
import styles from './styles.module.scss';

const { Text } = Typography;

type InputP = {
  label?: string;
} & React.ComponentProps<typeof AntdInput>;

export const Input: React.FC<InputP> = ({ label, ...props }) => {
  if (!label) {
    return <AntdInput {...props} />;
  }
  return (
    <div className={styles.input}>
      <Text type={props.status === 'error' ? 'danger' : undefined} strong>
        {label}
      </Text>
      <AntdInput {...props} />
    </div>
  );
};
