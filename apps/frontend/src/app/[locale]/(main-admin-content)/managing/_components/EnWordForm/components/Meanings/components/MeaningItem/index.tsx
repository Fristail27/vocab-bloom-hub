import React from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Button, Input as AntdInput, Typography } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Input } from '@/core/ui/Input';
import { EnMeaningT, WordLevelE, EnAreaVariantsE, LanguageRegisterE, CategoryE } from 'server/types';
import { RegionalLabelSelect } from '../../../RegionalLabelSelect';
import { WordLevelSelect } from '../../../WordLevelSelect';
import { LanguageRegisterSelect } from '../../../LanguageRegisterSelect';
import { CategorySelect } from '../../../CategoriesSelect';
import styles from './styles.module.scss';

const { Text } = Typography;
const { TextArea } = AntdInput;

type MeaningItemP = {
  meaning: EnMeaningT;
  onChange: (meaning: EnMeaningT) => void;
  onDelete: (sortOrder: number) => void;
};

export const MeaningItem: React.FC<MeaningItemP> = ({ meaning, onChange, onDelete }) => {
  const t = useTranslations('en_managing_words');
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
      <Button
        className={styles.deleteMeaning}
        type="primary"
        danger
        onClick={() => onDelete(meaning.sort_order)}
      >
        <CloseOutlined />
      </Button>
      <Badge className={styles.sortOrder} color="blue" count={meaning.sort_order} />
      <Input
        className={styles.shortMeaning}
        label={t('short_meaning')}
        value={meaning.title}
        onChange={(e) => onChange({ ...meaning, title: e.target.value })}
      />
      <div className={styles.subline}>
        <RegionalLabelSelect
          value={meaning.area_variant as EnAreaVariantsE}
          onChange={(v) => onChange({ ...meaning, area_variant: v as EnAreaVariantsE })}
        />
        <WordLevelSelect
          value={meaning.meaning_level as WordLevelE}
          onChange={(v) => onChange({ ...meaning, meaning_level: v as WordLevelE })}
        />
        <LanguageRegisterSelect
          onChange={(v) => onChange({ ...meaning, language_register: v })}
          value={meaning.language_register as LanguageRegisterE}
        />
      </div>
      <CategorySelect
        containerClassName={styles.categories}
        value={meaning.categories as CategoryE[]}
        onChange={(v) => onChange({ ...meaning, categories: v })}
      />
      <div className={styles.inputContainer}>
        <Text strong>{t('full_meaning_description')}</Text>
        <TextArea
          value={meaning.definition}
          onChange={(e) => onChange({ ...meaning, definition: e.target.value })}
        />
      </div>
      <div className={styles.examples}>
        <div className={styles.examplesTitle}>
          <Text strong>{t('examples')}</Text>
          <Button size="small" className={styles.addBtn} onClick={addExample} type="primary">
            <PlusOutlined />
          </Button>
        </div>
        {meaning.examples.map((example, i) => (
          <div className={styles.example} key={i.toString()}>
            <Input onChange={(e) => onChangeExample(e.target.value, i)} value={example} />
            <Button type="primary" danger onClick={() => deleteExample(i)}>
              <CloseOutlined />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
