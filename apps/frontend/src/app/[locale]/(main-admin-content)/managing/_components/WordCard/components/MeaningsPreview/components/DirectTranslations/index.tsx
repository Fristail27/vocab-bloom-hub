import { EnMeaningTranslationT } from 'server/types';
import React from 'react';
import { Button, Tag } from 'antd';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { WordCardModeE } from '../../../../constants';
import { IconNamesT } from '@/core/ui/icons/types';
import styles from './styles.module.scss';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';

type DirectTranslationsP = {
  translation: EnMeaningTranslationT;
  mode?: WordCardModeE;
  onEdit?: () => void;
  onDelete?: () => void;
};

export const DirectTranslations: React.FC<DirectTranslationsP> = ({ translation, onEdit, mode, onDelete }) => {
  return (
    <div className={styles.directTranslations}>
      {mode === WordCardModeE.edit && (
        <>
          <Button className={styles.iconBtn} size="small" type="primary" onClick={onEdit}>
            <EditOutlined />
          </Button>
          <Button type="primary" danger className={styles.iconBtn} size="small" onClick={onDelete}>
            <CloseOutlined />
          </Button>
        </>
      )}
      <Icon name={FlagByAreaEnum[translation.language] as IconNamesT} size="medium" />
      {translation.variants_of_words.map((v, i) => (
        <Tag key={i} variant="outlined" color="orange">
          {v}
        </Tag>
      ))}
    </div>
  );
};
