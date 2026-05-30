import React from 'react';
import { useParams } from 'next/navigation';
import { Typography } from 'antd';
import styles from './styles.module.scss';

const { Text, Link } = Typography;

type WordAlreadyExistBlockP = {
  word: string;
};

export const WordAlreadyExistBlock: React.FC<WordAlreadyExistBlockP> = ({ word }) => {
  const params = useParams();
  const { lang } = params;

  return (
    <div className={styles.wordAlreadyExistBlock}>
      <Text>
        Слово <Text strong>{word}</Text> уже существет
      </Text>
      <Link href={`/${lang}/admin-panel/dictionary/en/edit-word/${word}`}>Редактировать слово?</Link>
    </div>
  );
};
