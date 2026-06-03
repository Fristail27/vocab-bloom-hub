import React from 'react';
import { Button } from 'antd';
import { AvailableTranslationLanguagesE, EnMeaningT, EnMeaningTranslationT } from 'server/types';
import { MeaningPreview } from '../MeaningsTranslations/components/MeaningPreview';
import { MeaningTranslation } from '../MeaningsTranslations/components/MeaningTranslation';
import styles from './styles.module.scss';

type MeaningTranslationsP = {
  meanings: EnMeaningT[];
  onClickNext: () => void;
  setMeanings: (meanings: EnMeaningT[]) => void;
};

export const MeaningsTranslations: React.FC<MeaningTranslationsP> = ({
  setMeanings,
  onClickNext,
  meanings,
}) => {
  const addTranslation = (id: number) => {
    const newTranslation: EnMeaningTranslationT = {
      id: Math.random(),
      title: '',
      definition: '',
      variantsOfWords: [],
      language: AvailableTranslationLanguagesE.ru,
    };
    setMeanings(
      meanings.map((m) => (m.id === id ? { ...m, translation: [...m.translation, newTranslation] } : m)),
    );
  };
  const onChangeTranslation = (meaningId: number, translation: EnMeaningTranslationT) => {
    setMeanings(
      meanings.map((m) =>
        m.id === meaningId
          ? { ...m, translation: m.translation.map((t) => (t.id === translation.id ? translation : t)) }
          : m,
      ),
    );
  };

  const onDeleteTranslation = (meaningId: number, translationId: number) => {
    setMeanings(
      meanings.map((m) =>
        m.id === meaningId ? { ...m, translation: m.translation.filter((t) => t.id !== translationId) } : m,
      ),
    );
  };
  return (
    <div className={styles.meaningsTranslations}>
      {meanings.map((m) => (
        <div key={m.id}>
          <MeaningPreview m={m} />
          <div className={styles.translations}>
            {m.translation.map((t, i) => (
              <MeaningTranslation
                key={`${i}-${m.id}`}
                t={t}
                deleteTranslation={(translationId) => onDeleteTranslation(m.id, translationId)}
                onChange={(t) => onChangeTranslation(m.id, t)}
              />
            ))}
            <Button type="primary" onClick={() => addTranslation(m.id)}>
              Добавить перевод
            </Button>
          </div>
        </div>
      ))}
      <Button onClick={onClickNext}>Далее</Button>
    </div>
  );
};
