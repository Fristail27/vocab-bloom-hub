import React from 'react';
import { useTranslations } from 'next-intl';
import { Typography } from 'antd';
import { EnWordFormsE, EnWordFormT } from 'server/types';
import { getCurrentForms } from './utils';
import { WordCardModeE } from '../../constants';
import { WordFormItem } from './components/WordFormItem';
import styles from './styles.module.scss';
import { AddOrEditWordFormModal } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/components/AddOrEditWordFormModal';

const { Text } = Typography;

type WordFormsP = {
  forms: EnWordFormT[];
  formNames: EnWordFormsE[];
  mode: WordCardModeE;
};

export const WordForms: React.FC<WordFormsP> = ({ forms, formNames, mode }) => {
  const [modalData, setModalData] = React.useState<EnWordFormT | null>(null);
  const t = useTranslations('en_managing_words');

  const closeFormModal = () => setModalData(null);
  return (
    <>
      <AddOrEditWordFormModal data={modalData} onClose={closeFormModal} />
      <div className={styles.wordForms}>
        <Text strong>{t('word_forms')}</Text>
        <div className={styles.forms}>
          {formNames.map((name) => (
            <WordFormItem
              key={name}
              name={name}
              forms={getCurrentForms(name, forms)}
              mode={mode}
              setModalData={setModalData}
            />
          ))}
        </div>
      </div>
    </>
  );
};
