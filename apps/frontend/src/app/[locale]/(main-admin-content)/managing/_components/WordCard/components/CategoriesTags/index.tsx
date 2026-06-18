import React from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Typography } from 'antd';
import { CategoryE } from 'server/types';
import styles from './styles.module.scss';

const { Text } = Typography;

type CategoriesTagsP = {
  categories: CategoryE[];
  word: string;
};

export const CategoriesTags: React.FC<CategoriesTagsP> = ({ word, categories }) => {
  const t = useTranslations('en_managing_words');
  return (
    <div className={styles.categoriesTags}>
      <Text strong>{t('domain')}</Text>
      <div className={styles.tags}>
        {categories.map((c) => (
          <Tag key={word + c} className={styles.tag} color="geekblue" variant="outlined">
            {t(`cat_${c}`)}
          </Tag>
        ))}
      </div>
    </div>
  );
};
