'use client';
import React from 'react';
import { Tag, Typography } from 'antd';
import { EnPartOfSpeechE, EnWordT } from 'server/dist/types';
import { WordForms } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms';
import { FormsByPartOfSpeech } from '@/app/[locale]/(main-admin-content)/managing/_components/EnWordForm/constants';
import styles from './styles.module.scss';
import { Icon } from '@/core/ui/Icon';
import { FlagByAreaEnum } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/WordForms/constants';
import { IconNamesT } from '@/core/ui/icons/types';
import { NounInfoTags } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/NounInfoTags';
import { useTranslations } from 'next-intl';
import { VerbInfoTags } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/VerbInfoTags';
import { CategoriesTags } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/CategoriesTags';
import { ShortTranslationsPreview } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/ShortTranslationsPreview';
import { MeaningsPreview } from '@/app/[locale]/(main-admin-content)/managing/_components/WordCard/components/MeaningsPreview';

const { Text } = Typography;

type WordCardP = {
  word: Omit<EnWordT, 'word'> & { word: string };
};

export const WordCard: React.FC<WordCardP> = ({ word }) => {
  const t = useTranslations('en_managing_words');
  const formNames = FormsByPartOfSpeech[word.part_of_speech];
  return (
    <section className={styles.wordCard}>
      <div className={styles.line}>
        <Tag className={styles.mainTag} color="volcano" variant="outlined">
          <Icon name={FlagByAreaEnum[word.area_variant] as IconNamesT} />
          {word.word}
        </Tag>
        <Tag color="blue" variant="outlined">
          {word.part_of_speech}
        </Tag>
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
      {formNames && <WordForms forms={word.forms} formNames={formNames} />}
      <ShortTranslationsPreview translations={word.short_translations} />
      <MeaningsPreview meanings={word.meanings} />
    </section>
  );
};
