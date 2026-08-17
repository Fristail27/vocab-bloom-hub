import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { App, Button, Popover, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { EnSearchWordT } from 'server/types';
import { DeletePopoverContent } from '../DeletePopoverContent';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

type FoundWordP = {
  w: EnSearchWordT;
  onDeleted: (id: EnSearchWordT['id']) => void;
};

const { Text } = Typography;

export const FoundWord: React.FC<FoundWordP> = ({ w, onDeleted }) => {
  const locale = useLocale();
  const tErr = useTranslations('errors');
  const t = useTranslations('en_managing_words');
  const { message } = App.useApp();
  const [deleting, setDeleting] = React.useState(false);

  const onDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await EnApi.deleteWord(w.id);

      if ('error' in res) {
        const mes = tErr(res.message);
        message.error(mes);
      } else {
        const mes = t('word_deleted_successfully');
        message.success(mes);
        onDeleted(w.id);
      }
    } finally {
      setDeleting(false);
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
        <Popover
          content={<DeletePopoverContent onDelete={onDelete} deleting={deleting} />}
          title={w.word}
          trigger="click"
        >
          <Button type="primary" danger>
            <DeleteOutlined />
          </Button>
        </Popover>
      </div>
    </div>
  );
};
