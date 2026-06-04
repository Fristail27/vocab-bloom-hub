import React from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Typography } from 'antd';
import { EnWordFormsE, EnWordFormT } from 'server/types';
import { getCurrentForms } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/utils';
import { getTitle } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/FormsOfWordLine/utils';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import styles from './styles.module.scss';

const { Text } = Typography;
type WordFormsP = {
  forms: EnWordFormT[];
  formNames: EnWordFormsE[];
};
export const WordForms: React.FC<WordFormsP> = ({ forms, formNames }) => {
  const t = useTranslations('en_managing_words');

  return (
    <div className={styles.wordForms}>
      <Text strong>{t('word_forms')}</Text>
      {formNames.map((name) => (
        <div className={styles.formLine} key={name}>
          <Text className={styles.formTitle}>{getTitle(name)}:</Text>
          <div className={styles.wordsOfForm}>
            {getCurrentForms(name, forms).map((f) => (
              <div className={styles.word} key={f.id}>
                <Tag className={styles.wordTag} color="purple" variant="outlined">
                  <Icon name={FlagByAreaEnum[f.area_variant] as IconNamesT} />
                  {f.word}
                </Tag>
                <Tag className={styles.tag} color="geekblue" variant="outlined">
                  <Text>{t('pronunciation')}:</Text>
                  {f.transcription}
                </Tag>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
