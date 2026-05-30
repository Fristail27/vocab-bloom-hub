import React from 'react';
import { Button, Input as AntdInput, Typography } from 'antd';
import { optionRender } from '@/core/ui/Select/utils';
import { Select } from '@/core/ui/Select';
import { Input } from '@/core/ui/Input';
import { AvailableTranslationLanguagesE, EnShortTranslationT } from 'server/types';
import styles from './styles.module.scss';

const { TextArea } = AntdInput;
const { Text } = Typography;

type ShortTranslationP = {
  shortTranslation: EnShortTranslationT;
  setShortTranslation: (v: EnShortTranslationT) => void;
  onClickNext: () => void;
};

export const ShortTranslation: React.FC<ShortTranslationP> = ({
  shortTranslation,
  setShortTranslation,
  onClickNext,
}) => {
  const onChangeVariantOfWord = (v: string, ind: number) => {
    setShortTranslation({
      ...shortTranslation,
      variantsOfWords: shortTranslation.variantsOfWords.map((w, i) => (i === ind ? v : w)),
    });
  };
  const addWord = () => {
    setShortTranslation({
      ...shortTranslation,
      variantsOfWords: [...shortTranslation.variantsOfWords, ''],
    });
  };
  return (
    <div className={styles.shortTranslation}>
      <Select
        className={styles.select}
        options={[{ value: AvailableTranslationLanguagesE.ru, label: AvailableTranslationLanguagesE.ru }]}
        optionRender={optionRender}
        value={shortTranslation.language}
        onChange={(v) =>
          setShortTranslation({ ...shortTranslation, language: v as AvailableTranslationLanguagesE })
        }
        label="Язык"
      />
      <div>
        <Text strong>Перевод описания</Text>
        <TextArea
          rows={14}
          value={shortTranslation.description}
          onChange={(e) => setShortTranslation({ ...shortTranslation, description: e.target.value })}
        />
      </div>
      <div className={styles.variantsOfWords}>
        {shortTranslation.variantsOfWords.map((v, i) => (
          <Input key={i} value={v} onChange={(e) => onChangeVariantOfWord(e.target.value, i)} />
        ))}
        <Button type="primary" onClick={addWord}>
          Добавить вариант перевода
        </Button>
      </div>
      <Button className={styles.nextButton} type="primary" onClick={onClickNext}>
        Далее
      </Button>
    </div>
  );
};
