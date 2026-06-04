'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { EnPartsOfSpeech } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/constants';
import { EnPartOfSpeechE } from 'server/types';
import styles from './styles.module.scss';

type CheckWordBlockP = {
  word: string;
  setWord: (w: string) => void;
  partOfSpeech: EnPartOfSpeechE | null;
  setPartOfSpeech: (p: EnPartOfSpeechE) => void;
  checkWord: () => void;
};

export const CheckWordBlock: React.FC<CheckWordBlockP> = ({
  word,
  setWord,
  partOfSpeech,
  setPartOfSpeech,
  checkWord,
}) => {
  const t = useTranslations('en_managing_words');

  return (
    <div className={styles.checkWordBlock}>
      <Input
        className={styles.wordInput}
        label={t('word')}
        onChange={(e) => setWord(e.target.value)}
        value={word}
      />
      <Select
        options={EnPartsOfSpeech}
        label={t('part_of_speech')}
        className={styles.posSelect}
        value={partOfSpeech}
        onChange={setPartOfSpeech}
      />
      <Button
        className={styles.checkButton}
        disabled={!word || !partOfSpeech}
        onClick={() => checkWord()}
        size="middle"
        type="primary"
      >
        <CheckCircleOutlined />
      </Button>
    </div>
  );
};
