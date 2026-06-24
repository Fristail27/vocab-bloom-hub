'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { App, Button, Tag, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { EditOutlined } from '@ant-design/icons';
import { EnMeaningT, EnPartOfSpeechE, EnShortTranslationT, EnWordFormT, EnWordT } from 'server/types';
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
import { UpdateTypeE, WordCardModeE } from './constants';
import { EditCommonDataModal } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/EditCommonDataModal';
import { CommonInfoDataT } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/types';
import { EnApi } from '@/core/api/EnApi';
import styles from './styles.module.scss';

const { Text } = Typography;

type WordCardP = {
  word: EnWordT;
  mode?: WordCardModeE | undefined;
};

export const WordCard: React.FC<WordCardP> = ({ word, mode = WordCardModeE.view }) => {
  const [state, setState] = useState<EnWordT>(word);
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

      setState((p) => ({ ...p, ...data }));
    }
  };

  const updateFormOfWord = (f: EnWordFormT, type: UpdateTypeE) => {
    switch (type) {
      case UpdateTypeE.add:
        setState((p) => ({ ...p, forms: [...p.forms, f] }));
        break;
      case UpdateTypeE.edit:
        setState((p) => ({ ...p, forms: p.forms.map((fo) => (fo.id === f.id ? f : fo)) }));
        break;
      case UpdateTypeE.delete:
        setState((p) => ({ ...p, forms: p.forms.filter((fo) => fo.id !== f.id) }));
        break;
    }
  };

  const updateShortTranslation = (t: EnShortTranslationT, type: UpdateTypeE) => {
    switch (type) {
      case UpdateTypeE.add:
        setState((p) => ({ ...p, short_translations: [...p.short_translations, t] }));
        break;
      case UpdateTypeE.edit:
        setState((p) => ({
          ...p,
          short_translations: p.short_translations.map((tr) => (tr.id === t.id ? t : tr)),
        }));
        break;
      case UpdateTypeE.delete:
        setState((p) => ({ ...p, short_translations: p.short_translations.filter((f) => f.id !== t.id) }));
        break;
    }
  };

  const updateMeaning = (m: EnMeaningT, type: UpdateTypeE) => {
    switch (type) {
      case UpdateTypeE.add:
        setState((p) => ({ ...p, meanings: [...p.meanings, m] }));
        break;
      case UpdateTypeE.edit:
        setState((p) => ({
          ...p,
          meanings: p.meanings.map((tr) => (tr.id === m.id ? m : tr)),
        }));
        break;
      case UpdateTypeE.delete:
        setState((p) => ({ ...p, meanings: p.meanings.filter((f) => f.id !== m.id) }));
        break;
    }
  };

  const updatePhrasal = (v: string | null) => setState((p) => ({ ...p, base_phrasal: v || undefined }));

  return (
    <>
      <EditCommonDataModal
        data={state}
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
            {state.transcription}
          </Tag>
          <Tag className={styles.tag} color="success" variant="outlined">
            <Text>{t('level')}:</Text>
            {state.word_level}
          </Tag>
          <Tag className={styles.tag} color="geekblue" variant="outlined">
            <Text>{t('register')}:</Text>
            {state.language_register}
          </Tag>
          <Tag className={styles.tag} color="geekblue" variant="outlined">
            {t('is_obsolete')}
          </Tag>
          {state.generated && (
            <Tag className={styles.tag} color="geekblue" variant="outlined">
              {t('is_ai_generated')}
            </Tag>
          )}
          {state.generated && (
            <Tag className={styles.tag} color="geekblue" variant="outlined">
              <Text>{t('source_model')}:</Text>
              {state.generated_by_model}
            </Tag>
          )}
        </div>
        {word.part_of_speech === EnPartOfSpeechE.noun && <NounInfoTags word={state} />}
        {word.part_of_speech === EnPartOfSpeechE.verb && (
          <VerbInfoTags word={state} mode={mode} updatePhrasal={updatePhrasal} />
        )}
        {state.categories && state.categories.length > 0 && (
          <CategoriesTags categories={state.categories || []} word={word.word} />
        )}
        <div className={styles.desc}>
          <Text strong>{t('description')}</Text>
          <Text code>{state.description}</Text>
        </div>
        {word.part_of_speech === EnPartOfSpeechE.grammar_pattern && state.pattern && (
          <div className={styles.desc}>
            <Text strong>{t('pattern')}</Text>
            <Text italic>{state.pattern?.join(' ')}</Text>
          </div>
        )}
        {formNames && (
          <WordForms
            updateFormOfWord={updateFormOfWord}
            forms={state.forms}
            formNames={formNames}
            mode={mode}
          />
        )}
        <ShortTranslationsPreview
          translations={state.short_translations}
          mode={mode}
          updateShortTranslation={updateShortTranslation}
        />
        <MeaningsPreview meanings={state.meanings} mode={mode} updateMeaning={updateMeaning} />
      </section>
    </>
  );
};
