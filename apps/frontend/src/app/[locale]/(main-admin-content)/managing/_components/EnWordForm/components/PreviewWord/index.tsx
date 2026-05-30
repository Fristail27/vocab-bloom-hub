import React from 'react';
import { Button, Checkbox } from 'antd';
import { EnWordFormModeE } from '../../constants';
import styles from './styles.module.scss';

type PreviewWordP = {
  addWord: () => void;
  wordIsChecked: boolean;
  setWordIsChecked: (v: boolean) => void;
  mode: EnWordFormModeE;
  editWord: () => void;
};

export const PreviewWord: React.FC<PreviewWordP> = ({
  addWord,
  wordIsChecked,
  setWordIsChecked,
  mode,
  editWord,
}) => {
  return (
    <div className={styles.previewWord}>
      {/*<WordCard lang={lang as LanguagesE} wordEntry={w}/>*/}
      <Checkbox checked={wordIsChecked} onChange={(e) => setWordIsChecked(e.target.checked)}>
        Слово проверено (!need_to_check)
      </Checkbox>
      {mode === EnWordFormModeE.add && (
        <Button className={styles.saveBtn} type="primary" onClick={addWord}>
          Добавить слово
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
