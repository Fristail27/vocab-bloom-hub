import React from 'react';
import { Typography } from 'antd';
import { BaseOptionType, LabelInValueType } from '@rc-component/select/es/Select';
import { FlattenOptionData } from '@rc-component/select/es/interface';
import allIcons from '@/core/ui/icons';
import { Icon } from '@/core/ui/Icon';
import styles from '../../../components/LanguageSwitch/styles.module.scss';

const { Text } = Typography;

export const optionRender = (
  option: FlattenOptionData<BaseOptionType & { icons?: Array<keyof typeof allIcons> }>,
): React.ReactNode => {
  return (
    <div className={styles.option}>
      {option.data.icons && option.data.icons.map((ic) => <Icon key={ic} name={ic} size="medium" />)}
      <Text>{option.label}</Text>
    </div>
  );
};

export const labelRender = (option: LabelInValueType, icons: Array<keyof typeof allIcons>): React.ReactNode => {
  return (
    <div className={styles.option}>
      {icons && icons.map((ic) => <Icon key={ic} name={ic} size="medium" />)}
      <Text>{option.label}</Text>
    </div>
  );
};
