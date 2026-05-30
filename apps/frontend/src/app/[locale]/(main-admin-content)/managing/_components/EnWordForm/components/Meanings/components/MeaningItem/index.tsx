import React from 'react';
import { Button, Input as AntdInput, Radio, Typography } from 'antd';
import { PlusCircleFilled } from '@ant-design/icons';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { EnMeaningT, LanguageRegisterE, WordLevelE } from 'server/types';
import {
  AreaVariants,
  Levels,
} from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/constants';
import { EnAreaVariantsE } from 'server/types';
import { optionRender } from '@/core/ui/Select/utils';
import styles from './styles.module.scss';

const { Text } = Typography;
const { TextArea } = AntdInput;

type MeaningItemP = {
  meaning: EnMeaningT;
  onChange: (meaning: EnMeaningT) => void;
  onDelete: (sortOrder: number) => void;
};

export const MeaningItem: React.FC<MeaningItemP> = ({ meaning, onChange, onDelete }) => {
  const onChangeExample = (v: string, i: number) => {
    onChange({
      ...meaning,
      examples: meaning.examples.map((ex, ind) => {
        if (i === ind) {
          return v;
        }
        return ex;
      }),
    });
  };

  const addExample = () => onChange({ ...meaning, examples: [...meaning.examples, ''] });

  const deleteExample = (i: number) => {
    onChange({ ...meaning, examples: meaning.examples.filter((ex, ind) => i !== ind) });
  };

  return (
    <div className={styles.meaningItemContainer}>
      <div className={styles.line}>
        <div className={styles.leftPart}>
          <div className={styles.subline}>
            <Text strong>{meaning.sort_order}.</Text>
            <Input
              label="Значение коротко"
              value={meaning.title}
              onChange={(e) => onChange({ ...meaning, title: e.target.value })}
            />
            <Select
              className={styles.select}
              label="Региональная маркированность"
              options={AreaVariants}
              optionRender={optionRender}
              value={meaning.area_variant}
              onChange={(v) => onChange({ ...meaning, area_variant: v as EnAreaVariantsE })}
            />
            <Select
              label="Уровень слова"
              options={Levels}
              className={styles.select}
              value={meaning.meaning_level}
              onChange={(v) => onChange({ ...meaning, meaning_level: v as WordLevelE })}
            />
          </div>
          <div className={styles.inputContainer}>
            <Text strong>Описание подробней</Text>
            <TextArea
              value={meaning.definition}
              onChange={(e) => onChange({ ...meaning, definition: e.target.value })}
            />
          </div>
        </div>
        <div className={styles.selectContainer}>
          <Text strong>language register</Text>
          <Radio.Group
            vertical
            className={styles.radio}
            onChange={(e) => onChange({ ...meaning, language_register: e.target.value })}
            value={meaning.language_register}
          >
            <Radio value={LanguageRegisterE.formal}>formal</Radio>
            <Radio value={LanguageRegisterE.informal}>informal</Radio>
            <Radio value={LanguageRegisterE.slang}>slang</Radio>
          </Radio.Group>
        </div>
        <Button type="primary" danger onClick={() => onDelete(meaning.sort_order)}>
          Удалить
        </Button>
      </div>
      <div className={styles.examples}>
        <div className={styles.examplesTitle}>
          <Text strong>Примеры</Text>
          <Button className={styles.addBtn} onClick={addExample} type="primary">
            <PlusCircleFilled />
          </Button>
        </div>
        {meaning.examples.map((example, i) => (
          <div className={styles.example} key={i.toString()}>
            <Input onChange={(e) => onChangeExample(e.target.value, i)} value={example} />
            <Button type="primary" danger onClick={() => deleteExample(i)}>
              Удалить пример
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
