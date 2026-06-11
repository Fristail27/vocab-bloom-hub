import React from 'react';
import { Button, Input as AntdInput, Typography } from 'antd';
import { Input } from '@/core/ui/Input';
import { EnShortTranslationT } from 'server/types';
import { useTranslations } from 'next-intl';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { TranslationLanguageSelect } from '../../../TranslationLanguageSelect';
import styles from './styles.module.scss';

const { TextArea } = AntdInput;
const { Text } = Typography;

type ShortTranslationP = {
  shortTranslation: EnShortTranslationT;
  setShortTranslation: (v: EnShortTranslationT) => void;
  deleteTranslation: (id: EnShortTranslationT['id']) => void;
};

export const ShortTranslation: React.FC<ShortTranslationP> = ({
  shortTranslation,
  setShortTranslation,
  deleteTranslation,
}) => {
  const t = useTranslations('en_managing_words');

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
      <div className={styles.title}>
        <TranslationLanguageSelect
          value={shortTranslation.language}
          onChange={(v) => setShortTranslation({ ...shortTranslation, language: v })}
        />
        <Button onClick={() => deleteTranslation(shortTranslation.id)} type="primary" danger>
          <CloseOutlined />
        </Button>
      </div>
      <div>
        <Text strong>{t('translation_desc')}</Text>
        <TextArea
          rows={14}
          value={shortTranslation.description}
          onChange={(e) => setShortTranslation({ ...shortTranslation, description: e.target.value })}
        />
      </div>
      <div className={styles.variantsOfWords}>
        <div className={styles.subtitle}>
          <Text strong>{t('translation_variants')}</Text>
          <Button size="small" type="primary" onClick={addWord}>
            <PlusOutlined />
          </Button>
        </div>
        {shortTranslation.variantsOfWords.map((v, i) => (
          <Input key={i} value={v} onChange={(e) => onChangeVariantOfWord(e.target.value, i)} />
        ))}
      </div>
    </div>
  );
};
