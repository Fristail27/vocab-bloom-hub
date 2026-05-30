import React from 'react';
import { Button, Typography } from 'antd';
import { PlusCircleFilled } from '@ant-design/icons';
import { MeaningItem } from './components/MeaningItem';
import { EnAreaVariantsE, EnMeaningT, LanguageRegisterE, WordLevelE } from 'server/types';
import styles from './styles.module.scss';

const { Text } = Typography;

type MeaningsP = {
  onClickNext: () => void;
  meanings: EnMeaningT[];
  setMeanings: (values: EnMeaningT[]) => void;
};

export const Meanings: React.FC<MeaningsP> = ({ meanings, setMeanings, onClickNext }) => {
  const addMeaning = () => {
    setMeanings([
      ...meanings,
      {
        id: Math.random(),
        title: '',
        definition: '',
        sort_order: meanings.length + 1,
        area_variant: EnAreaVariantsE.common,
        language_register: LanguageRegisterE.formal,
        examples: [],
        meaning_level: WordLevelE.unknown,
        translation: [],
      },
    ]);
  };

  const onChange = (meaning: EnMeaningT) => {
    setMeanings(
      meanings.map((m) => {
        if (m.sort_order === meaning.sort_order) {
          return meaning;
        }
        return m;
      }),
    );
  };

  const onDelete = (sortOrder: number) => {
    const filteredMeanings = meanings.filter((m) => m.sort_order !== sortOrder);
    setMeanings(filteredMeanings);
  };
  return (
    <div className={styles.meanings}>
      <div className={styles.title}>
        <Text strong>Значения слова</Text>
        <Button className={styles.addBtn} onClick={addMeaning} type="primary">
          <PlusCircleFilled />
        </Button>
      </div>
      {meanings.map((m) => (
        <MeaningItem key={m.sort_order} onDelete={onDelete} onChange={onChange} meaning={m} />
      ))}
      <Button type="primary" onClick={onClickNext} className={styles.nextButton}>
        Далее
      </Button>
    </div>
  );
};
