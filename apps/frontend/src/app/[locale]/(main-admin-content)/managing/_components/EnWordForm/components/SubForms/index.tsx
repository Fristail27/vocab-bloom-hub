import React, { useEffect } from 'react';
import { Button } from 'antd';
import { FormsOfWordLine } from '../FormsOfWordLine';
import { getDefaultSubForm } from '../../utils';
import { EnAreaVariantsE, EnPartOfSpeechE, EnWordFormsE, EnWordFormT } from 'server/types';
import { FormsByPartOfSpeech } from '../../constants';
import styles from './styles.module.scss';

type SubFormsP = {
  onClickFormsNext: () => void;
  pos: EnPartOfSpeechE;
  subForms: EnWordFormT[];
  setSubForms: (v: EnWordFormT[]) => void;
};

export const SubForms: React.FC<SubFormsP> = ({ onClickFormsNext, pos, subForms, setSubForms }) => {
  const currentForms = FormsByPartOfSpeech[pos as keyof typeof FormsByPartOfSpeech] || [];
  const onChange = (w: EnWordFormT) => {
    setSubForms(subForms.map((f) => (f.id === w.id ? w : f)));
  };
  const addField = (key: EnWordFormsE) => {
    setSubForms([...subForms, getDefaultSubForm(key)]);
  };

  const deleteField = (id: number) => {
    setSubForms(subForms.filter((el) => el.id !== id));
  };

  useEffect(() => {
    if (subForms.length === 0) {
      setSubForms(
        currentForms.map((f) => ({
          form_of_word: f,
          id: Math.random(),
          word: '',
          transcription: '',
          area_variant: EnAreaVariantsE.common,
        })),
      );
    }
  }, []);

  return (
    <div className={styles.subFormsContainer}>
      <div className={styles.subForms}>
        {currentForms.map((subFormTitle: EnWordFormsE) => (
          <FormsOfWordLine
            key={subFormTitle}
            values={subForms.filter((f) => f.form_of_word === subFormTitle)}
            title={subFormTitle}
            onChange={(w) => onChange(w)}
            addField={() => addField(subFormTitle)}
            deleteField={(id) => deleteField(id)}
          />
        ))}
      </div>
      <Button onClick={onClickFormsNext} className={styles.nextButton} type="primary">
        Далее
      </Button>
    </div>
  );
};
