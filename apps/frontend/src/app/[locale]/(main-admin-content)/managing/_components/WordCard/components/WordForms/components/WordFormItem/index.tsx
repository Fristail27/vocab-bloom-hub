import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Typography, Button, message } from 'antd';
import { CloseOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { getTitle } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/components/FormsOfWordLine/utils';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import { EnWordFormsE, EnWordFormT } from 'server/types';
import { WordCardModeE } from '../../../../constants';
import { getDefaultNewFormData } from './utils';
import styles from './styles.module.scss';
import { DeleteWordFormModal } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/components/DeleteWordFormModal';
import { EnApi } from '@/core/api/EnApi';

const { Text } = Typography;

type WordFormItemP = {
  name: EnWordFormsE;
  forms: EnWordFormT[];
  mode: WordCardModeE;
  setModalData: (data: EnWordFormT) => void;
};

export const WordFormItem: React.FC<WordFormItemP> = ({ name, forms, mode, setModalData }) => {
  const [deleteModalData, setDeleteModalData] = useState<EnWordFormT | null>(null);
  const t = useTranslations('en_managing_words');

  const onDeleteForm = async (f: EnWordFormT) => {
    const res = await EnApi.deleteWord(f.id);
    if ('error' in res) {
      message.error(t(res.message));
    } else {
      message.success(t('delete_word_form_success'));
    }
  };

  return (
    <div className={styles.formLine} key={name}>
      {mode === WordCardModeE.edit && (
        <Button size="small" type="primary" onClick={() => setModalData(getDefaultNewFormData(name))}>
          <PlusOutlined />
        </Button>
      )}
      <Text className={styles.formTitle}>{getTitle(name)}:</Text>
      <div className={styles.wordsOfForm}>
        {forms.map((f) => (
          <div className={styles.word} key={f.id}>
            <div className={styles.buttons}>
              <DeleteWordFormModal
                form={deleteModalData as EnWordFormT}
                isOpen={deleteModalData?.id === f.id}
                onClose={() => setDeleteModalData(null)}
                onOk={onDeleteForm}
              />
              <Button size="small" className={styles.deleteBtn} type="primary" onClick={() => setModalData(f)}>
                <EditOutlined />
              </Button>
              <Button
                size="small"
                className={styles.deleteBtn}
                type="primary"
                danger
                onClick={() => setDeleteModalData(f)}
              >
                <CloseOutlined />
              </Button>
            </div>
            <Tag className={styles.wordTag} color="purple" variant="outlined">
              <Icon name={FlagByAreaEnum[f.area_variant] as IconNamesT} />
              {f.word}
            </Tag>
            <Tag className={styles.tag} color="geekblue" variant="outlined">
              <Text>{t('pronunciation')}:</Text>
              {f.transcription}
            </Tag>
          </div>
        ))}
      </div>
    </div>
  );
};
