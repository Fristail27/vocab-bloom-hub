import React from 'react';
import { Button, Input as AntdInput, Typography } from 'antd';
import {
  AvailableTranslationLanguagesE,
  EnMeaningTranslationT,
} from '../../../../../../../../../../../../server/types';
import { Select } from '@/core/ui/Select';
import { Input } from '@/core/ui/Input';
import styles from './styles.module.scss';

const { TextArea } = AntdInput;
const { Text } = Typography;

type MeaningTranslationP = {
  t: EnMeaningTranslationT;
  onChange: (value: EnMeaningTranslationT) => void;
  deleteTranslation: (translationId: number) => void;
};

export const MeaningTranslation: React.FC<MeaningTranslationP> = ({ t, onChange, deleteTranslation }) => {
  const onChangeVariantOfWord = (v: string, ind: number) => {
    onChange({
      ...t,
      variantsOfWords: t.variantsOfWords.map((w, i) => (i === ind ? v : w)),
    });
  };

  const addWord = () => {
    onChange({
      ...t,
      variantsOfWords: [...t.variantsOfWords, ''],
    });
  };

  return (
    <div className={styles.meaningTranslation}>
      <div className={styles.firstLine}>
        <Select
          disabled
          value={t.language}
          onChange={(v) => onChange({ ...t, language: v as AvailableTranslationLanguagesE })}
        />
        <Button type="primary" danger onClick={() => deleteTranslation(t.id)}>
          Удалить
        </Button>
      </div>

      <Input
        label="Краткий перевод"
        value={t.title}
        onChange={(e) => onChange({ ...t, title: e.target.value })}
      />
      <div>
        <Text strong>Полный перевод</Text>
        <TextArea value={t.definition} onChange={(e) => onChange({ ...t, definition: e.target.value })} />
      </div>
      <div className={styles.variantsOfWords}>
        {t.variantsOfWords.map((v, i) => (
          <Input key={i} value={v} onChange={(e) => onChangeVariantOfWord(e.target.value, i)} />
        ))}
        <Button type="primary" onClick={addWord}>
          Добавить вариант перевода
        </Button>
      </div>
    </div>
  );
};
