import React from 'react';
import { Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { EnMeaningT } from 'server/types';
import { WordLinks } from '../../../WordLinks';
import styles from './styles.module.scss';

const { Text } = Typography;

type MeaningPreviewP = {
  m: EnMeaningT;
};

export const MeaningPreview: React.FC<MeaningPreviewP> = ({ m }) => {
  const t = useTranslations('en_managing_words');

  return (
    <div className={styles.meaningPreview}>
      <Text strong>
        {m.sort_order}. {m.title}
      </Text>
      <Text italic>{m.definition}</Text>
      <div className={styles.meaningInfo}>
        <Text>
          <Text strong>{t('level')}:</Text> {m.meaning_level}
        </Text>
        <Text>
          <Text strong>{t('register')}:</Text> {m.language_register}
        </Text>
        <Text>
          <Text strong>{t('regional_label')}:</Text> {m.area_variant}
        </Text>
      </div>
      {(m.synonyms ?? []).length > 0 && (
        <div className={styles.wordLinksContainer}>
          <Text strong>{t('synonyms')}:</Text>
          <WordLinks kind="synonyms" words={m.synonyms} />
        </div>
      )}
      {(m.antonyms ?? []).length > 0 && (
        <div className={styles.wordLinksContainer}>
          <Text strong>{t('antonyms')}:</Text>
          <WordLinks kind="antonyms" words={m.antonyms} />
        </div>
      )}
      <div className={styles.examplesContainer}>
        <Text strong>{t('examples')}:</Text>
        <div className={styles.examples}>
          {m.examples.map((ex) => (
            <Text key={ex} keyboard>
              {ex}
            </Text>
          ))}
        </div>
      </div>
    </div>
  );
};
