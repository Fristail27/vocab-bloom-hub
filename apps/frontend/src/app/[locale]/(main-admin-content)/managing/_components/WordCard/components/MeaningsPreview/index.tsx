import React from 'react';
import { useTranslations } from 'next-intl';
import { Typography } from 'antd';
import { EnMeaningT } from 'server/types';
import { MeaningPreview } from './components/MeaningPreview';
import styles from './styles.module.scss';

const { Text } = Typography;
type MeaningsPreviewP = {
  meanings: EnMeaningT[];
};
export const MeaningsPreview: React.FC<MeaningsPreviewP> = ({ meanings }) => {
  const t = useTranslations('en_managing_words');
  return (
    <div className={styles.meaningsPreview}>
      <Text strong>{t('word_meanings')}</Text>
      <div>
        {meanings.map((meaning: EnMeaningT) => (
          <MeaningPreview meaning={meaning} key={meaning.id} />
        ))}
      </div>
    </div>
  );
};
