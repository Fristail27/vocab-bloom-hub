import React from 'react';
import { Typography } from 'antd';
import styles from './styles.module.scss';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

type WordDoesntExistBlockP = {
  word: string;
};

export const WordDoesntExistBlock: React.FC<WordDoesntExistBlockP> = ({ word }) => {
  const t = useTranslations('en_managing_words');
  const tErr = useTranslations('errors');
  return (
    <div className={styles.wordAlreadyExistBlock}>
      <Text type="danger">
        {t('word')}{' '}
        <Text type="danger" strong>
          {word}
        </Text>{' '}
        {tErr('phrasal_base_doesnt_exist')}
      </Text>
    </div>
  );
};
