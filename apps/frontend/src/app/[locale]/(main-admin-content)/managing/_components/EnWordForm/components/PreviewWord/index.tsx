import React from 'react';
import { Button } from 'antd';
import { EnWordT } from 'server/types';
import { WordCard } from '../../../WordCard';
import { EnWordFormModeE } from '../../constants';
import styles from './styles.module.scss';
import { useTranslations } from 'next-intl';

type PreviewWordP = {
  addWord: () => void;
  mode: EnWordFormModeE;
  editWord: () => void;
  word: Omit<EnWordT, 'word'> & { word: string };
};

export const PreviewWord: React.FC<PreviewWordP> = ({ addWord, mode, editWord, word }) => {
  const t = useTranslations('managing');
  return (
    <div className={styles.previewWord}>
      <WordCard word={word} />
      {mode === EnWordFormModeE.add && (
        <Button className={styles.saveBtn} type="primary" onClick={addWord}>
          {t('add_word')}
        </Button>
      )}
      {mode === EnWordFormModeE.edit && (
        <Button className={styles.saveBtn} type="primary" onClick={editWord}>
          Сохранить
        </Button>
      )}
    </div>
  );
};
