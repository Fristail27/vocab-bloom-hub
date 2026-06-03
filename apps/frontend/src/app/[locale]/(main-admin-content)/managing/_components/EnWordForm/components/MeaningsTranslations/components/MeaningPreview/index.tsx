import React from 'react';
import { Typography } from 'antd';
import { EnMeaningT } from '../../../../../../../../../../../../server/types';
import styles from './styles.module.scss';

const { Text } = Typography;

type MeaningPreviewP = {
  m: EnMeaningT;
};

export const MeaningPreview: React.FC<MeaningPreviewP> = ({ m }) => {
  return (
    <div className={styles.meaningPreview}>
      <Text strong>
        {m.sort_order}. {m.title}
      </Text>
      <Text italic>{m.definition}</Text>
      <div className={styles.meaningInfo}>
        <Text>
          <Text strong>Уровень:</Text> {m.meaning_level}
        </Text>
        <Text>
          <Text strong>Language register:</Text> {m.language_register}
        </Text>
        <Text>
          <Text strong>Региональность:</Text> {m.area_variant}
        </Text>
      </div>
      <div className={styles.examplesContainer}>
        <Text strong>Примеры:</Text>
        <div className={styles.examples}>
          {m.examples.map((ex) => (
            <Text key={ex} keyboard>
              {ex}
            </Text>
          ))}
        </div>
      </div>
    </div>
  );
};
