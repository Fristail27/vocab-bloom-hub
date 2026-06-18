import { useTranslations } from 'next-intl';
import { Button, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import styles from './styles.module.scss';
import React from 'react';

const { Text } = Typography;

type DeletePopoverContentP = {
  onDelete: () => void;
};

export const DeletePopoverContent: React.FC<DeletePopoverContentP> = ({ onDelete }) => {
  const t = useTranslations('en_managing_words');

  return (
    <div className={styles.deletePopoverContent}>
      <Text>{t('delete_word_mes')}</Text>
      <Text strong>{t('cant_undone')}</Text>
      <Button type="primary" danger onClick={onDelete}>
        <DeleteOutlined />
        {t('delete_word')}
      </Button>
    </div>
  );
};
