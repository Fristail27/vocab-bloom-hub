import React from 'react';
import { Button, Typography } from 'antd';
import { EnMeaningTranslationT } from 'server/types';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import { Icon } from '@/core/ui/Icon';
import { WordCardModeE } from '../../../../constants';
import styles from './styles.module.scss';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';

const { Text } = Typography;

type MeaningTranslationP = {
  text: string;
  language: EnMeaningTranslationT['language'];
  mode: WordCardModeE;
  onEdit: () => void;
  onDelete: () => void;
};

export const MeaningTranslation: React.FC<MeaningTranslationP> = ({
  language,
  text,
  mode,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={styles.meaningTranslation}>
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
      <Icon name={FlagByAreaEnum[language] as IconNamesT} size="medium" />
      <Text>{text}</Text>
    </div>
  );
};
