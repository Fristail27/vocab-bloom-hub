import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Typography } from 'antd';
import { EnMeaningT } from 'server/types';
import styles from './styles.module.scss';

const { Text } = Typography;
type DeleteMeaningModalP = {
  onClose: () => void;
  onOk: (t: EnMeaningT) => void | Promise<void>;
  isOpen: boolean;
  meaning: EnMeaningT;
};

export const DeleteMeaningModal: React.FC<DeleteMeaningModalP> = ({ isOpen, onClose, onOk, meaning }) => {
  const t = useTranslations('en_managing_words');
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onOk(meaning);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      okButtonProps={{ danger: true }}
      title={t('delete_word_form')}
      open={isOpen}
      onOk={handleOk}
      confirmLoading={submitting}
      onCancel={onClose}
      className={styles.deleteModal}
    >
      <Text strong>
        {meaning.sort_order} - {meaning.title}
      </Text>
      <Text>{t('delete_meaning_desc')}</Text>
    </Modal>
  );
};
