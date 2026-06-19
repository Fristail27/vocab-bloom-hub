'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { App, Button, Tag, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { EditOutlined } from '@ant-design/icons';
import { EnPartOfSpeechE, EnWordT } from 'server/types';
import { WordForms } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms';
import { FormsByPartOfSpeech } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/constants';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import { NounInfoTags } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/NounInfoTags';
import { useTranslations } from 'next-intl';
import { VerbInfoTags } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/VerbInfoTags';
import { CategoriesTags } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/CategoriesTags';
import { ShortTranslationsPreview } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/ShortTranslationsPreview';
import { MeaningsPreview } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/MeaningsPreview';
import { WordCardModeE } from './constants';
import { EditCommonDataModal } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/EditCommonDataModal';
import { CommonInfoDataT } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/types';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

const { Text } = Typography;

type WordCardP = {
  word: Omit<EnWordT, 'word'> & { word: string };
  mode?: WordCardModeE | undefined;
};

export const WordCard: React.FC<WordCardP> = ({ word, mode = WordCardModeE.view }) => {
  const [showEditDataModal, setShowEditDataModal] = useState<boolean>(false);
  const t = useTranslations('en_managing_words');
  const tError = useTranslations('errors');
  const { wordId } = useParams();
  const { message } = App.useApp();
  const formNames = FormsByPartOfSpeech[word.part_of_speech];

  const editCommonInfo = async (data: Omit<CommonInfoDataT, 'id' | 'form_of_word' | 'base_phrasal'>) => {
    const res = await EnApi.editCommonInfoOfWord(wordId as string, data);

    if ('error' in res) {
      message.error(tError(res.message));
    } else {
      setShowEditDataModal(false);
    }
  };

  return (
    <>
      <EditCommonDataModal
        data={word}
        isOpen={showEditDataModal}
        onClose={() => setShowEditDataModal(false)}
        pos={word.part_of_speech}
        submit={editCommonInfo}
      />
      <section className={styles.wordCard}>
        {mode === WordCardModeE.edit && (
          <Button
            className={styles.editCommonData}
            type="primary"
            size="small"
            onClick={() => setShowEditDataModal(true)}
          >
            <EditOutlined />
            {t('edit_common_data_btn')}
          </Button>
        )}
        <div className={clsx(styles.line, styles.mainLine)}>
          <Tag className={styles.mainTag} color="volcano" variant="outlined">
            <Icon name={FlagByAreaEnum[word.area_variant] as IconNamesT} />
            {word.word}
          </Tag>
          <Tag color="blue" variant="outlined">
            {word.part_of_speech}
          </Tag>
        </div>
        <div className={styles.line}>
          <Tag className={styles.tag} color="geekblue" variant="outlined">
            <Text>{t('pronunciation')}:</Text>
            {word.transcription}
          </Tag>
          <Tag className={styles.tag} color="success" variant="outlined">
            <Text>{t('level')}:</Text>
            {word.word_level}
          </Tag>
          <Tag className={styles.tag} color="geekblue" variant="outlined">
            <Text>{t('register')}:</Text>
            {word.language_register}
          </Tag>
          <Tag className={styles.tag} color="geekblue" variant="outlined">
            {t('is_obsolete')}
          </Tag>
          {word.generated && (
            <Tag className={styles.tag} color="geekblue" variant="outlined">
              {t('is_ai_generated')}
            </Tag>
          )}
          {word.generated && (
            <Tag className={styles.tag} color="geekblue" variant="outlined">
              <Text>{t('source_model')}:</Text>
              {word.generated_by_model}
            </Tag>
          )}
        </div>
        {word.part_of_speech === EnPartOfSpeechE.noun && <NounInfoTags word={word} />}
        {word.part_of_speech === EnPartOfSpeechE.verb && <VerbInfoTags word={word} />}
        {word.categories && word.categories.length > 0 && (
          <CategoriesTags categories={word.categories || []} word={word.word} />
        )}
        <div className={styles.desc}>
          <Text strong>Описание:</Text>
          <Text code>{word.description}</Text>
        </div>
        {formNames && <WordForms forms={word.forms} formNames={formNames} mode={mode} />}
        <ShortTranslationsPreview translations={word.short_translations} mode={mode} />
        <MeaningsPreview meanings={word.meanings} mode={mode} />
      </section>
    </>
  );
};
