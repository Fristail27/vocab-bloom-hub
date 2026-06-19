import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Typography, Badge, Tag, Button, App } from 'antd';
import { CloseOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { EnAreaVariantsE, EnMeaningT, EnMeaningTranslationT } from 'server/types';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import { MeaningTranslation } from '../MeaningTranslation';
import { DirectTranslations } from '../DirectTranslations';
import { WordCardModeE } from '../../../../constants';
import { DeleteMeaningModal } from '../DeleteMeaningModal';
import { EnApi } from '@/core/api/EnApi';
import { DefaultTranslation } from './constants';
import styles from './styles.module.scss';
import { AddOrEditMeaningTranslationModal } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/MeaningsPreview/components/AddOrEditMeaningTranslationModal';
import { DeleteMeaningTranslationModal } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/MeaningsPreview/components/DeleteMeaningTranslationModal';

const { Text } = Typography;
type MeaningPreviewP = {
  meaning: EnMeaningT;
  mode: WordCardModeE;
  setEditData: (d: EnMeaningT) => void;
};

export const MeaningPreview: React.FC<MeaningPreviewP> = ({ meaning, mode, setEditData }) => {
  const [isOpenDelete, setIsOpenDelete] = useState(false);
  const [addTranslationData, setAddTranslationData] = useState<EnMeaningTranslationT | null>(null);
  const [deleteTranslationData, setDeleteTranslationData] = useState<EnMeaningTranslationT | null>(null);
  const t = useTranslations('en_managing_words');
  const tError = useTranslations('errors');
  const { message } = App.useApp();

  const deleteMeaning = async () => {
    const res = await EnApi.deleteMeaning(meaning.id);
    if ('error' in res) {
      message.error(tError(res.message));
    } else {
      message.success(t('delete_meaning_success'));
    }
  };

  const deleteMeaningTranslation = async (id: number) => {
    const res = await EnApi.deleteMeaningTranslation(id);
    if ('error' in res) {
      message.error(tError(res.message));
    } else {
      message.success(t('delete_meaning_tr_success'));
    }
  };

  return (
    <>
      <DeleteMeaningModal
        meaning={meaning}
        onClose={() => setIsOpenDelete(false)}
        isOpen={isOpenDelete}
        onOk={deleteMeaning}
      />
      <DeleteMeaningTranslationModal
        translation={deleteTranslationData}
        onClose={() => setDeleteTranslationData(null)}
        isOpen={!!deleteTranslationData}
        onOk={deleteMeaningTranslation}
      />
      <AddOrEditMeaningTranslationModal
        meaningId={meaning.id}
        isOpen={!!addTranslationData}
        onClose={() => setAddTranslationData(null)}
        data={addTranslationData}
      />
      <div className={styles.meaningPreview}>
        <div className={styles.titleLine}>
          {mode === WordCardModeE.edit && (
            <>
              <Button
                className={styles.addBtn}
                size="small"
                type="primary"
                onClick={() => setEditData(meaning)}
              >
                <EditOutlined />
              </Button>
              <Button
                type="primary"
                danger
                className={styles.deleteBtn}
                size="small"
                onClick={() => setIsOpenDelete(true)}
              >
                <CloseOutlined />
              </Button>
            </>
          )}
          <Badge color="geekblue" count={meaning.sort_order} />
          <Icon size="medium" name={FlagByAreaEnum[meaning.area_variant as EnAreaVariantsE] as IconNamesT} />
          {meaning.categories?.map((category) => (
            <Tag variant="outlined" color="cyan" key={meaning.id + category}>
              {t(`cat_${category}`)}
            </Tag>
          ))}
        </div>
        {mode === WordCardModeE.edit && (
          <Button
            className={styles.addTranslationBtn}
            size="small"
            type="primary"
            onClick={() => setAddTranslationData(DefaultTranslation)}
          >
            <PlusOutlined />
            {t('add_translation')}
          </Button>
        )}
        <div className={styles.textDescription}>
          <Text className={styles.title}>{t('short_meaning')}:</Text>
          <Text className={styles.def} italic>
            {meaning.title}
          </Text>
          <div className={styles.meaningTranslationsContainer}>
            <Text className={styles.title}>{t('translation_short_meaning')}:</Text>
            <div className={styles.meaningTranslations}>
              {meaning.translations.map((tr) => (
                <MeaningTranslation
                  onDelete={() => setDeleteTranslationData(tr)}
                  onEdit={() => setAddTranslationData(tr)}
                  key={tr.id}
                  language={tr.language}
                  text={tr.title}
                  mode={mode}
                />
              ))}
            </div>
          </div>
        </div>
        <div className={styles.textDescription}>
          <Text className={styles.title}>{t('full_meaning_description')}:</Text>
          <Text className={styles.def} italic>
            {meaning.definition}
          </Text>
          <div className={styles.meaningTranslationsContainer}>
            <Text className={styles.title}>{t('translation_full_meaning')}:</Text>
            <div className={styles.meaningTranslations}>
              {meaning.translations.map((tr) => (
                <MeaningTranslation
                  onEdit={() => setAddTranslationData(tr)}
                  onDelete={() => setDeleteTranslationData(tr)}
                  key={tr.id}
                  language={tr.language}
                  text={tr.definition}
                  mode={mode}
                />
              ))}
            </div>
          </div>
        </div>
        <div className={styles.textDescription}>
          <Text className={styles.title}>{t('translation_variants')}:</Text>
          <div className={styles.directTranslations}>
            {meaning.translations.map((tr) => (
              <DirectTranslations
                key={tr.id}
                translation={tr}
                onEdit={() => setAddTranslationData(tr)}
                onDelete={() => setDeleteTranslationData(tr)}
                mode={mode}
              />
            ))}
          </div>
        </div>
        <div className={styles.examplesContainer}>
          <Text className={styles.title}>{t('examples')}:</Text>
          <div className={styles.examples}>
            {meaning.examples.map((ex) => (
              <Text key={ex} keyboard>
                {ex}
              </Text>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
