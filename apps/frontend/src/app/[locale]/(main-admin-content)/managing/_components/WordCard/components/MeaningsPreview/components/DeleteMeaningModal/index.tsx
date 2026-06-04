import React from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Typography } from 'antd';
import { EnMeaningT } from 'server/types';
import styles from './styles.module.scss';

const { Text } = Typography;
type DeleteMeaningModalP = {
  onClose: () => void;
  onOk: (t: EnMeaningT) => void;
  isOpen: boolean;
  meaning: EnMeaningT;
};

export const DeleteMeaningModal: React.FC<DeleteMeaningModalP> = ({ isOpen, onClose, onOk, meaning }) => {
  const t = useTranslations('en_managing_words');
  return (
    <Modal
      okButtonProps={{ danger: true }}
      title={t('delete_word_form')}
      open={isOpen}
      onOk={() => onOk(meaning)}
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
