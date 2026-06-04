import { EnMeaningTranslationT } from 'server/types';
import React from 'react';
import { Tag } from 'antd';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import styles from './styles.module.scss';

type DirectTranslationsP = {
  translation: EnMeaningTranslationT;
};

export const DirectTranslations: React.FC<DirectTranslationsP> = ({ translation }) => {
  return (
    <div className={styles.directTranslations}>
      <Icon name={FlagByAreaEnum[translation.language] as IconNamesT} size="medium" />
      {translation.variantsOfWords.map((v, i) => (
        <Tag key={i} variant="outlined" color="orange">
          {v}
        </Tag>
      ))}
    </div>
  );
};
