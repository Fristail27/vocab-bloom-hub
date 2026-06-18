import React from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Typography } from 'antd';
import { EnWordFormT } from 'server/types';
import styles from './styles.module.scss';

const { Text } = Typography;
type AddOrEditWordFormModalP = {
  onClose: () => void;
  onOk: (f: EnWordFormT) => void;
  isOpen: boolean;
  form: EnWordFormT;
};

export const DeleteWordFormModal: React.FC<AddOrEditWordFormModalP> = ({ isOpen, onClose, onOk, form }) => {
  const t = useTranslations('en_managing_words');
  return (
    <Modal
      okButtonProps={{ danger: true }}
      title={t('delete_word_form')}
      open={isOpen}
      onOk={() => onOk(form)}
      onCancel={onClose}
      className={styles.deleteModal}
    >
      <Text strong>
        {form?.form_of_word} - {form?.word}
      </Text>
      <Text>{t('delete_word_form_desc')}</Text>
    </Modal>
  );
};
