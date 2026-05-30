'use client';

import React from 'react';
import { Radio, Typography } from 'antd';
import { CommonAndProperVariants, CountableVariants, RegularityVariants } from './constants';
import { NounSettingsT } from './types';
import styles from './styles.module.scss';

const { Text } = Typography;

type NounSettingsP = {
  setSettings: (nounSettings: boolean | string, field: keyof NounSettingsT) => void;
} & NounSettingsT;

export const NounSettings: React.FC<NounSettingsP> = ({
  setSettings,
  noun___is_proper,
  noun___countable,
  noun___irregular_plural,
}) => {
  return (
    <div className={styles.nounSettings}>
      <div className={styles.radioContainer}>
        <Text strong>Countable / Uncountable</Text>
        <Radio.Group
          className={styles.radio}
          vertical
          onChange={(e) => setSettings(e.target.value, 'noun___countable')}
          value={noun___countable}
          options={CountableVariants}
        />
      </div>
      <div className={styles.radioContainer}>
        <Text strong>Common / Proper</Text>
        <Radio.Group
          className={styles.radio}
          vertical
          onChange={(e) => setSettings(e.target.value, 'noun___is_proper')}
          value={noun___is_proper}
          options={CommonAndProperVariants}
        />
      </div>
      <div className={styles.radioContainer}>
        <Text strong>Regular / Irregular</Text>
        <Radio.Group
          className={styles.radio}
          vertical
          onChange={(e) => setSettings(e.target.value, 'noun___irregular_plural')}
          value={noun___irregular_plural}
          options={RegularityVariants}
        />
      </div>
    </div>
  );
};
