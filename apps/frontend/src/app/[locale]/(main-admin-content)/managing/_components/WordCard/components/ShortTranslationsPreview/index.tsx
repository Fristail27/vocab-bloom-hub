import React from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Typography } from 'antd';
import { EnShortTranslationT } from 'server/types';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import styles from './styles.module.scss';

const { Text } = Typography;

type ShortTranslationsPreviewP = {
  translations: EnShortTranslationT[];
};

export const ShortTranslationsPreview: React.FC<ShortTranslationsPreviewP> = ({ translations }) => {
  const t = useTranslations('en_managing_words');

  return (
    <div className={styles.shortTranslationsPreview}>
      <Text strong>{t('short_translations')}</Text>
      <div>
        {translations.map((translation) => (
          <div className={styles.translation} key={translation.language}>
            <Text className={styles.title}>{t('translation_desc')}:</Text>
            <div className={styles.desc}>
              <Icon size="medium" name={FlagByAreaEnum[translation.language] as IconNamesT} />
              <Text>{translation.description}</Text>
            </div>
            <div className={styles.variantsOfWord}>
              {translation.variantsOfWords.map((v) => (
                <Tag key={v} color="orange" variant="outlined">
                  {v}
                </Tag>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
