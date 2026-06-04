import React from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Typography } from 'antd';
import { AvailableTranslationLanguagesE, EnShortTranslationT } from 'server/types';
import styles from './styles.module.scss';
import { TranslationLanguageSelect } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/TranslationLanguageSelect';

const { Text } = Typography;
type DeleteShortTranslationModalP = {
  onClose: () => void;
  onOk: (t: EnShortTranslationT) => void;
  isOpen: boolean;
  translation: EnShortTranslationT | null;
};

export const DeleteShortTranslationModal: React.FC<DeleteShortTranslationModalP> = ({
  isOpen,
  onClose,
  onOk,
  translation,
}) => {
  const t = useTranslations('en_managing_words');
  return (
    <Modal
      okButtonProps={{ danger: true }}
      title={t('delete_word_form')}
      open={isOpen}
      onOk={() => onOk(translation as EnShortTranslationT)}
      onCancel={onClose}
      className={styles.deleteModal}
    >
      <TranslationLanguageSelect
        value={translation?.language as AvailableTranslationLanguagesE}
        onChange={() => {}}
        disabled
      />
      <Text>{t('delete_short_translation_desc')}</Text>
    </Modal>
  );
};
