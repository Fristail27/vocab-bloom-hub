import React from 'react';
import { useTranslations } from 'next-intl';
import { Tag } from 'antd';
import { EnWordT } from 'server/types';
import styles from './styles.module.scss';

type WordCardP = {
  word: Omit<EnWordT, 'word'> & { word: string };
};

export const NounInfoTags: React.FC<WordCardP> = ({ word }) => {
  const t = useTranslations('en_managing_words');
  return (
    <div className={styles.nounTags}>
      {word.noun___always_plural && (
        <Tag color="geekblue" variant="outlined">
          {t('is_plural_only')}
        </Tag>
      )}
      {word.noun___uncountable && (
        <Tag color="orange" variant="outlined">
          {t('is_uncountable')}
        </Tag>
      )}
      {word.noun___irregular_plural && (
        <Tag color="green" variant="outlined">
          {t('has_irregular_plural')}
        </Tag>
      )}
      {word.noun___is_proper && (
        <Tag color="cyan" variant="outlined">
          {t('is_proper_noun')}
        </Tag>
      )}
      {word.is_abbreviation && (
        <Tag color="purple" variant="outlined">
          {t('is_abbreviation')}
        </Tag>
      )}
    </div>
  );
};
