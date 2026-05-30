import React from 'react';
import { Typography } from 'antd';
import styles from './styles.module.scss';

const { Text } = Typography;

type WordDoesntExistBlockP = {
  word: string;
};

export const WordDoesntExistBlock: React.FC<WordDoesntExistBlockP> = ({ word }) => {
  return (
    <div className={styles.wordAlreadyExistBlock}>
      <Text>
        Слово <Text strong>{word}</Text> Не существует, сначала добавьте базовую форму фразового глагола
      </Text>
    </div>
  );
};
