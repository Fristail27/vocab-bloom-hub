import React from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Typography } from 'antd';
import { EnWordT } from 'server/types';
import styles from './styles.module.scss';

const { Text } = Typography;

type WordCardP = {
  word: Omit<EnWordT, 'word'> & { word: string };
};

export const VerbInfoTags: React.FC<WordCardP> = ({ word }) => {
  const t = useTranslations('en_managing_words');
  return (
    <div className={styles.verbTags}>
      {word.verb___is_phrasal && (
        <Tag color="geekblue" variant="outlined">
          {t('verb_is_phrasal')}
        </Tag>
      )}
      {word.verb___is_phrasal && (
        <Tag className={styles.tag} color="geekblue" variant="outlined">
          <Text>{t('phrasal_base')}:</Text>
          {word.base_phrasal}
        </Tag>
      )}
      {word.verb___transitivity && (
        <Tag className={styles.tag} color="orange" variant="outlined">
          <Text>{t('verb_transitivity')}:</Text>
          {word.verb___transitivity}
        </Tag>
      )}
      {word.verb___is_irregular && (
        <Tag className={styles.tag} color="green" variant="outlined">
          {t('verb_is_irregular')}
        </Tag>
      )}
      {word.verb___phrasal_object_pattern && (
        <Tag className={styles.tag} color="cyan" variant="outlined">
          <Text>{t('verb_phrasal_object_pattern')}:</Text>
          {word.verb___phrasal_object_pattern}
        </Tag>
      )}
    </div>
  );
};
