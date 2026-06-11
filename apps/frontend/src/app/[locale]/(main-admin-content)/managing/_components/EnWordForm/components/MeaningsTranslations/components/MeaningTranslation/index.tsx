import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input as AntdInput, Typography } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { AvailableTranslationLanguagesE, EnMeaningTranslationT } from 'server/types';
import { Input } from '@/core/ui/Input';
import { TranslationLanguageSelect } from '../../../TranslationLanguageSelect';
import styles from './styles.module.scss';

const { TextArea } = AntdInput;
const { Text } = Typography;

type MeaningTranslationP = {
  t: EnMeaningTranslationT;
  onChange: (value: EnMeaningTranslationT) => void;
  deleteTranslation: (translationId: number) => void;
};

export const MeaningTranslation: React.FC<MeaningTranslationP> = ({ t, onChange, deleteTranslation }) => {
  const tMan = useTranslations('en_managing_words');
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
      <Button className={styles.deleteTr} type="primary" danger onClick={() => deleteTranslation(t.id)}>
        <CloseOutlined />
      </Button>
      <TranslationLanguageSelect
        disabled
        value={t.language}
        onChange={(v) => onChange({ ...t, language: v as AvailableTranslationLanguagesE })}
      />
      <Input
        label={tMan('translation_short_meaning')}
        value={t.title}
        onChange={(e) => onChange({ ...t, title: e.target.value })}
      />
      <div>
        <Text strong>{tMan('translation_full_meaning')}</Text>
        <TextArea value={t.definition} onChange={(e) => onChange({ ...t, definition: e.target.value })} />
      </div>
      <div className={styles.variantsOfWords}>
        <div className={styles.subtitle}>
          <Text strong>{tMan('translation_variants')}</Text>
          <Button size="small" type="primary" onClick={addWord}>
            <PlusOutlined />
          </Button>
        </div>
        {t.variantsOfWords.map((v, i) => (
          <Input key={i} value={v} onChange={(e) => onChangeVariantOfWord(e.target.value, i)} />
        ))}
      </div>
    </div>
  );
};
