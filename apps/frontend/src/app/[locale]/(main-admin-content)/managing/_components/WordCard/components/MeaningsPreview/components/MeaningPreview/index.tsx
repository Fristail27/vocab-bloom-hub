import React from 'react';
import { useTranslations } from 'next-intl';
import { Typography, Badge, Tag } from 'antd';
import { EnAreaVariantsE, EnMeaningT } from 'server/types';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import { MeaningTranslation } from '../MeaningTranslation';
import styles from './styles.module.scss';
import { DirectTranslations } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/MeaningsPreview/components/DirectTranslations';

const { Text } = Typography;
type MeaningPreviewP = {
  meaning: EnMeaningT;
};

export const MeaningPreview: React.FC<MeaningPreviewP> = ({ meaning }) => {
  const t = useTranslations('en_managing_words');
  return (
    <div className={styles.meaningPreview}>
      <div className={styles.titleLine}>
        <Badge color="geekblue" count={meaning.sort_order} />
        <Icon size="medium" name={FlagByAreaEnum[meaning.area_variant as EnAreaVariantsE] as IconNamesT} />
        {meaning.categories?.map((category) => (
          <Tag variant="outlined" color="cyan" key={meaning.id + category}>
            {t(`cat_${category}`)}
          </Tag>
        ))}
      </div>
      <div className={styles.textDescription}>
        <Text className={styles.title}>{t('short_meaning')}:</Text>
        <Text className={styles.def} italic>
          {meaning.title}
        </Text>
        <div className={styles.meaningTranslationsContainer}>
          <Text className={styles.title}>{t('translation_short_meaning')}:</Text>
          <div className={styles.meaningTranslations}>
            {meaning.translations.map((tr) => (
              <MeaningTranslation key={tr.id} language={tr.language} text={tr.title} />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.textDescription}>
        <Text className={styles.title}>{t('full_meaning_description')}:</Text>
        <Text className={styles.def} italic>
          {meaning.definition}
        </Text>
        <div className={styles.meaningTranslationsContainer}>
          <Text className={styles.title}>{t('translation_full_meaning')}:</Text>
          <div className={styles.meaningTranslations}>
            {meaning.translations.map((tr) => (
              <MeaningTranslation key={tr.id} language={tr.language} text={tr.definition} />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.textDescription}>
        <Text className={styles.title}>{t('translation_variants')}:</Text>
        <div className={styles.directTranslations}>
          {meaning.translations.map((tr) => (
            <DirectTranslations key={tr.id} translation={tr} />
          ))}
        </div>
      </div>
      <div className={styles.examplesContainer}>
        <Text className={styles.title}>{t('examples')}:</Text>
        <div className={styles.examples}>
          {meaning.examples.map((ex) => (
            <Text key={ex} keyboard>
              {ex}
            </Text>
          ))}
        </div>
      </div>
    </div>
  );
};
