import React from 'react';
import { Typography } from 'antd';
import { EnMeaningTranslationT } from 'server/types';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import { Icon } from '@/core/ui/Icon';
import styles from './styles.module.scss';

const { Text } = Typography;
type MeaningTranslationP = {
  text: string;
  language: EnMeaningTranslationT['language'];
};
export const MeaningTranslation: React.FC<MeaningTranslationP> = ({ language, text }) => {
  return (
    <div className={styles.meaningTranslation}>
      <Icon name={FlagByAreaEnum[language] as IconNamesT} size="medium" />
      <Text>{text}</Text>
    </div>
  );
};
