import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { AvailableTranslationLanguagesE, EnShortTranslationT } from 'server/types';
import { ShortTranslation } from './components/ShortTranslation';
import styles from './styles.module.scss';

type ShortTranslationsP = {
  shortTranslations: EnShortTranslationT[];
  setShortTranslations: (v: EnShortTranslationT[]) => void;
  onClickNext: () => void;
};

export const ShortTranslations: React.FC<ShortTranslationsP> = ({
  shortTranslations,
  setShortTranslations,
  onClickNext,
}) => {
  const t = useTranslations('en_managing_words');
  const onChangeTranslation = (translation: EnShortTranslationT) => {
    setShortTranslations(shortTranslations.map((tr) => (tr.id === translation.id ? translation : tr)));
  };
  const addTranslation = () => {
    setShortTranslations([
      ...shortTranslations,
      {
        id: Math.random(),
        description: '',
        variants_of_words: [],
        language: AvailableTranslationLanguagesE.ru,
      },
    ]);
  };

  const deleteTranslation = (id: number) => {
    setShortTranslations(shortTranslations.filter((tr) => tr.id !== id));
  };
  return (
    <div className={styles.shortTranslation}>
      <Button disabled className={styles.addTranslationButton} type="primary" onClick={addTranslation}>
        {t('add_translation')}
      </Button>
      {shortTranslations.map((tr) => (
        <ShortTranslation
          key={tr.id}
          shortTranslation={tr}
          setShortTranslation={onChangeTranslation}
          deleteTranslation={deleteTranslation}
        />
      ))}
      <Button className={styles.nextButton} type="primary" onClick={onClickNext}>
        Далее
      </Button>
    </div>
  );
};
