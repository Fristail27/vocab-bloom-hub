import React from 'react';
import { Button } from 'antd';
import { useTranslations } from 'next-intl';
import { EnWordT } from 'server/types';
import { WordCard } from '../../../WordCard';
import { EnWordFormModeE } from '../../constants';
import styles from './styles.module.scss';

type PreviewWordP = {
  addWord: () => void;
  mode: EnWordFormModeE;
  word: Omit<EnWordT, 'word'> & { word: string };
};

export const PreviewWord: React.FC<PreviewWordP> = ({ addWord, mode, word }) => {
  const t = useTranslations('managing');
  return (
    <div className={styles.previewWord}>
      <WordCard word={word} />
      {mode === EnWordFormModeE.add && (
        <Button className={styles.saveBtn} type="primary" onClick={addWord}>
          {t('add_word')}
        </Button>
      )}
    </div>
  );
};
