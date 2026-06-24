'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { EnPartsOfSpeech } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/constants';
import { EnEntryTypesE, EnPartOfSpeechE } from 'server/types';
import styles from './styles.module.scss';
import { EntityTypeSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/EntityTypeSelect';

type CheckWordBlockP = {
  word: string;
  setWord: (w: string) => void;
  partOfSpeech: EnPartOfSpeechE | null;
  setPartOfSpeech: (p: EnPartOfSpeechE) => void;
  checkWord: () => void;
  type: EnEntryTypesE;
  setType: (t: EnEntryTypesE) => void;
};

export const CheckWordBlock: React.FC<CheckWordBlockP> = ({
  word,
  setWord,
  partOfSpeech,
  setPartOfSpeech,
  checkWord,
  type,
  setType,
}) => {
  const t = useTranslations('en_managing_words');

  return (
    <div className={styles.checkWordBlock}>
      <EntityTypeSelect value={type} onChange={setType} />
      <Input
        className={styles.wordInput}
        label={t('word')}
        onChange={(e) => setWord(e.target.value)}
        value={word}
      />
      {type === EnEntryTypesE.word && (
        <Select
          options={EnPartsOfSpeech}
          label={t('part_of_speech')}
          className={styles.posSelect}
          value={partOfSpeech}
          onChange={setPartOfSpeech}
        />
      )}
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
