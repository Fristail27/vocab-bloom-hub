import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CloseOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, message, Tag, Typography } from 'antd';
import clsx from 'clsx';
import { EnShortTranslationT } from 'server/types';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '../../../WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import { WordCardModeE } from '../../../WordCard/constants';
import { DefaultShortTranslationData } from './constants';
import { AddOrEditShortTranslationModal } from './components/AddOrEditShortTranslationModal';
import { DeleteShortTranslationModal } from './components/DeleteShortTranslationModal';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

const { Text } = Typography;

type ShortTranslationsPreviewP = {
  translations: EnShortTranslationT[];
  mode: WordCardModeE;
};

export const ShortTranslationsPreview: React.FC<ShortTranslationsPreviewP> = ({ translations, mode }) => {
  const [modalData, setModalData] = useState<EnShortTranslationT | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<EnShortTranslationT | null>(null);
  const t = useTranslations('en_managing_words');
  const tError = useTranslations('errors');

  const onDeleteShortTranslation = async (tr: EnShortTranslationT) => {
    const res = await EnApi.deleteShortTranslation(tr.id);

    if ('error' in res) {
      message.error(tError(res.message));
    } else {
      setDeleteModalData(null);
    }
  };
  return (
    <>
      <AddOrEditShortTranslationModal
        isOpen={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
      <DeleteShortTranslationModal
        isOpen={!!deleteModalData}
        onClose={() => setDeleteModalData(null)}
        translation={deleteModalData}
        onOk={onDeleteShortTranslation}
      />
      <div className={styles.shortTranslationsPreview}>
        <div className={styles.title}>
          <Text strong>{t('short_translations')}</Text>
          {mode === WordCardModeE.edit && (
            <Button
              className={styles.addBtn}
              size="small"
              type="primary"
              onClick={() => setModalData(DefaultShortTranslationData)}
            >
              <PlusOutlined />
            </Button>
          )}
        </div>
        <div className={styles.shortTranslationsList}>
          {translations.map((translation, i) => (
            <div className={clsx(styles.translation, styles[mode])} key={translation.language + i}>
              {mode === WordCardModeE.edit && (
                <Button
                  type="primary"
                  danger
                  className={styles.deleteBtn}
                  size="small"
                  onClick={() => setDeleteModalData(translation)}
                >
                  <CloseOutlined />
                </Button>
              )}
              {mode === WordCardModeE.edit && (
                <Button
                  onClick={() => setModalData(translation)}
                  type="primary"
                  className={styles.editBtn}
                  size="small"
                >
                  <EditOutlined />
                </Button>
              )}
              <Text className={styles.title}>{t('translation_desc')}:</Text>
              <div className={styles.desc}>
                <Icon size="medium" name={FlagByAreaEnum[translation.language] as IconNamesT} />
                <Text>{translation.description}</Text>
              </div>
              <div className={styles.variantsOfWord}>
                {translation.variants_of_words.map((v) => (
                  <Tag key={v} color="orange" variant="outlined">
                    {v}
                  </Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
