import React from 'react';
import { Button } from 'antd';
import { AvailableTranslationLanguagesE, EnMeaningT, EnMeaningTranslationT } from 'server/types';
import { MeaningPreview } from '../MeaningsTranslations/components/MeaningPreview';
import { MeaningTranslation } from '../MeaningsTranslations/components/MeaningTranslation';
import styles from './styles.module.scss';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('en_managing_words');
  const addTranslation = (id: number) => {
    const newTranslation: EnMeaningTranslationT = {
      id: Math.random(),
      title: '',
      definition: '',
      variants_of_words: [],
      language: AvailableTranslationLanguagesE.ru,
    };
    setMeanings(
      meanings.map((m) => (m.id === id ? { ...m, translations: [...m.translations, newTranslation] } : m)),
    );
  };
  const onChangeTranslation = (meaningId: number, translation: EnMeaningTranslationT) => {
    setMeanings(
      meanings.map((m) =>
        m.id === meaningId
          ? { ...m, translations: m.translations.map((t) => (t.id === translation.id ? translation : t)) }
          : m,
      ),
    );
  };

  const onDeleteTranslation = (meaningId: number, translationId: number) => {
    setMeanings(
      meanings.map((m) =>
        m.id === meaningId ? { ...m, translations: m.translations.filter((t) => t.id !== translationId) } : m,
      ),
    );
  };
  return (
    <div className={styles.meaningsTranslations}>
      {meanings.map((m) => (
        <div key={m.id}>
          <MeaningPreview m={m} />
          <div className={styles.translations}>
            {m.translations.map((t, i) => (
              <MeaningTranslation
                key={`${i}-${m.id}`}
                t={t}
                deleteTranslation={(translationId) => onDeleteTranslation(m.id, translationId)}
                onChange={(t) => onChangeTranslation(m.id, t)}
              />
            ))}
            <Button
              disabled={m.translations.length > 0}
              style={{ width: 'max-content' }}
              type="primary"
              onClick={() => addTranslation(m.id)}
            >
              <PlusOutlined />
              {t('add_translation')}
            </Button>
          </div>
        </div>
      ))}
      <Button onClick={onClickNext}>Далее</Button>
    </div>
  );
};
