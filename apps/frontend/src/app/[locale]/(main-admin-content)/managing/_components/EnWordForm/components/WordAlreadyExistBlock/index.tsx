import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Typography } from 'antd';
import { ErrorCodes } from 'server/core/constants/error_codes';
import styles from './styles.module.scss';

const { Text, Link } = Typography;

type WordAlreadyExistBlockP = {
  word: string;
  wordId?: number | null;
};

export const WordAlreadyExistBlock: React.FC<WordAlreadyExistBlockP> = ({ word, wordId }) => {
  const locale = useLocale();
  const t = useTranslations('en_managing_words');
  const tErr = useTranslations('errors');

  return (
    <div className={styles.wordAlreadyExistBlock}>
      <Text>
        <Text strong>{word}</Text> — {tErr(ErrorCodes.word_already_exists)}
      </Text>
      {wordId && <Link href={`/${locale}/managing/edit-word/${wordId}`}>{t('edit_word_link')}</Link>}
    </div>
  );
};
