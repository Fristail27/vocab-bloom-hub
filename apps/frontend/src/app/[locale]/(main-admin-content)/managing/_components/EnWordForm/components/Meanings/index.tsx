import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { MeaningItem } from './components/MeaningItem';
import { makeTempId } from '../../utils';
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
        id: makeTempId(),
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
    setMeanings(meanings.map((m) => (m.id === meaning.id ? meaning : m)));
  };

  const onDelete = (id: number) => {
    // sort_order — только порядок отображения, после удаления перенумеровываем
    const filteredMeanings = meanings.filter((m) => m.id !== id).map((m, i) => ({ ...m, sort_order: i + 1 }));
    setMeanings(filteredMeanings);
  };
  return (
    <div className={styles.meanings}>
      {meanings.map((m) => (
        <MeaningItem key={m.id} onDelete={onDelete} onChange={onChange} meaning={m} />
      ))}
      <div className={styles.title}>
        <Button className={styles.addBtn} onClick={addMeaning} type="primary">
          <PlusOutlined />
          {t('add_meaning')}
        </Button>
      </div>
      <Button
        type="primary"
        onClick={onClickNext}
        disabled={meanings.some((m) => !m.title.trim() || !m.definition.trim())}
        className={styles.nextButton}
      >
        {t('next_step')}
      </Button>
    </div>
  );
};
