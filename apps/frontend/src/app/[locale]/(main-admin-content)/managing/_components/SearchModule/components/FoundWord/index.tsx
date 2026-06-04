import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, message, Popover, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { EnWordT } from 'server/types';
import { DeletePopoverContent } from '../DeletePopoverContent';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

type FoundWordP = {
  w: EnWordT;
};

const { Text } = Typography;

export const FoundWord: React.FC<FoundWordP> = ({ w }) => {
  const locale = useLocale();
  const tErr = useTranslations('errors');
  const t = useTranslations('en_managing_words');

  const onDelete = async () => {
    const res = await EnApi.deleteWord(w.id);

    if ('error' in res) {
      const mes = tErr(res.message);
      message.error(mes);
    } else {
      const mes = t('word_deleted_successfully');
      message.success(mes);
    }
  };

  return (
    <div className={styles.foundWord}>
      <div className={styles.wordInfo}>
        <div className={styles.topLine}>
          <Text strong>{w.word}</Text>
          <Tag variant="outlined" color="orange">
            {w.part_of_speech}
          </Tag>
        </div>
        {w.forms && (
          <div className={styles.forms}>
            {w.forms.map((f) => (
              <Tag variant="outlined" color="geekblue" key={f.id}>
                {f.word}
              </Tag>
            ))}
          </div>
        )}
      </div>

      <div className={styles.buttons}>
        <Button type="primary" href={`/${locale}/managing/edit-word/${w.id}`}>
          <EditOutlined />
        </Button>
        <Popover content={<DeletePopoverContent onDelete={onDelete} />} title={w.word} trigger="click">
          <Button type="primary" danger>
            <DeleteOutlined />
          </Button>
        </Popover>
      </div>
    </div>
  );
};
