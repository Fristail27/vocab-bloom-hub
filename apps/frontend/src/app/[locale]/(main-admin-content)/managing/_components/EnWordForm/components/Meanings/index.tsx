import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { MeaningItem } from './components/MeaningItem';
import { EnAreaVariantsE, EnMeaningT, LanguageRegisterE } from 'server/types';
import styles from './styles.module.scss';

type MeaningsP = {
  onClickNext: () => void;
  meanings: EnMeaningT[];
  setMeanings: (values: EnMeaningT[]) => void;
};

export const Meanings: React.FC<MeaningsP> = ({ meanings, setMeanings, onClickNext }) => {
  const t = useTranslations('en_managing_words');
  const addMeaning = () => {
    setMeanings([
      ...meanings,
      {
        id: Math.random(),
        title: '',
        definition: '',
        is_obsolete: false,
        sort_order: meanings.length + 1,
        area_variant: EnAreaVariantsE.common,
        language_register: LanguageRegisterE.formal,
        examples: [],
        meaning_level: null,
        translations: [],
      },
    ]);
  };

  const onChange = (meaning: EnMeaningT) => {
    setMeanings(meanings.map((m) => (m.sort_order === meaning.sort_order ? meaning : m)));
  };

  const onDelete = (sortOrder: number) => {
    const filteredMeanings = meanings.filter((m) => m.sort_order !== sortOrder);
    setMeanings(filteredMeanings);
  };
  return (
    <div className={styles.meanings}>
      {meanings.map((m) => (
        <MeaningItem key={m.sort_order} onDelete={onDelete} onChange={onChange} meaning={m} />
      ))}
      <div className={styles.title}>
        <Button className={styles.addBtn} onClick={addMeaning} type="primary">
          <PlusOutlined />
          {t('add_meaning')}
        </Button>
      </div>
      <Button type="primary" onClick={onClickNext} className={styles.nextButton}>
        Далее
      </Button>
    </div>
  );
};
