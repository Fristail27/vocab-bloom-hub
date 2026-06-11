'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, message, Steps } from 'antd';
import { EnMeaningT, EnPartOfSpeechE, EnShortTranslationT, EnWordFormT, EnWordT } from 'server/types';
import { DefaultCommonData, DefaultShortTranslation, EnWordFormModeE } from './constants';
import { WordAlreadyExistBlock } from './components/WordAlreadyExistBlock';
import { CommonInfoDataT, StatusOfWordPresenceE } from './types';
import { Meanings } from './components/Meanings';
import { SubForms } from './components/SubForms';
import { CommonWordInfo } from './components/CommonWordInfo';
import { PreviewWord } from './components/PreviewWord';
import { ShortTranslations } from './components/ShortTranslations';
import { MeaningsTranslations } from './components/MeaningsTranslations';
import { getInitCommonInfo, getInitMeanings, getStepItems, mapInitForms } from './utils';
import { CheckWordBlock } from './components/CheckWordBlock';
import { EnApi } from '@/core/api/EnApi';
import { Title } from '@/core/ui/Title';
import { tres } from './info';
import styles from './styles.module.scss';

type AddWordFormP = {
  initData?: EnWordT | undefined;
  mode?: EnWordFormModeE | undefined;
};

export const EnWordForm: React.FC<AddWordFormP> = ({ initData, mode = EnWordFormModeE.add }) => {
  const t = useTranslations('en_managing_words');
  const tError = useTranslations('errors');
  const [step, setStep] = useState<number>(mode === EnWordFormModeE.edit ? 1 : 0);
  const [stepItems, setStepItems] = useState(getStepItems(t, mode === EnWordFormModeE.add));
  const [word, setWord] = useState<string>(initData?.word || '');
  const [partOfSpeech, setPartOfSpeech] = useState<EnPartOfSpeechE | null>(initData?.part_of_speech || null);
  const [commonInfo, setCommonInfo] = useState<CommonInfoDataT>(getInitCommonInfo(initData));
  const [shortTranslations, setShortTranslations] = useState<EnShortTranslationT[]>(
    initData?.short_translations || DefaultShortTranslation,
  );
  const [meanings, setMeanings] = useState<EnMeaningT[]>(getInitMeanings(initData?.meanings) || []);
  const [forms, setForms] = useState<EnWordFormT[]>(mapInitForms(initData?.forms || []));
  const [statusOfPresence, setStatusOfPresence] = useState<StatusOfWordPresenceE>(
    StatusOfWordPresenceE.notChecked,
  );
  const addWord = async () => {
    try {
      if (partOfSpeech) {
        const body: EnWordT = {
          ...commonInfo,
          word,
          part_of_speech: partOfSpeech,
          meanings,
          short_translations: shortTranslations,
          forms: forms.filter((c) => c.word.trim().length > 0),
        };
        if (body) {
          const res = await EnApi.addWord(body);
          if ('error' in res) {
            const mes = tError(res.message);
            message.error(mes);
          } else {
            const mes = t('added_success');
            message.success(mes);
            setWord('');
            setStatusOfPresence(StatusOfWordPresenceE.notChecked);
            setShortTranslations(DefaultShortTranslation);
            setPartOfSpeech(null);
            setCommonInfo(DefaultCommonData);
            setForms([]);
            setMeanings([]);
            setStep(0);
            setStepItems(getStepItems(t, mode === EnWordFormModeE.add));
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'unknown_error';
      message.error(tError(errorMessage));
    }
  };

  const editWord = async () => {
    try {
      // if (partOfSpeech) {
      //   let body: any = {
      //     word,
      //     part_of_speech: partOfSpeech,
      //     meanings,
      //     shortTranslations: [shortTranslation],
      //     forms: forms.map(({ languageRegister, ...f }) => f),
      //     ...commonInfo,
      //   };
      //   if (body) {
      //     body.forms = body.forms.filter((c: any) => c.word.length > 0);
      //     const res = await EnWordsApi.editWord(initData?.id as number, body);
      //
      //     if (res.success) {
      //       // router.push(`/${lang}/admin-panel/dictionary/en/edit-word`)
      //     } else {
      //       message.error('Не удалось добавить слово');
      //     }
      //   }
      // }
    } catch (err) {
      console.log(err);
    }
  };

  const checkWord = async () => {
    if (word && partOfSpeech) {
      const res = await EnApi.checkWord(word, partOfSpeech);

      if ('error' in res) {
        message.error(tError(res.message));
      } else {
        if (res.hasWord) {
          setStatusOfPresence(StatusOfWordPresenceE.present);
        } else {
          setStatusOfPresence(StatusOfWordPresenceE.absent);
          setStep(1);
          setStepItems(getStepItems(t, false));
          return true;
        }
      }
    }
  };
  const insertJSON = async () => {
    // TODO const te = await navigator.clipboard.readText();
    // TODO const { meanings, forms, short_translations, word: w, part_of_speech: p, ...commonInfo } = JSON.parse(te);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { meanings, forms, short_translations, word: w, part_of_speech: p, ...commonInfo } = tres;
    setMeanings(
      meanings.map((m: EnMeaningT, i: number) => ({
        ...m,
        id: i,
        translations: m.translations.map((t, ind: number) => ({ ...t, id: ind })),
      })),
    );
    if (forms) {
      setForms(forms.map((f: EnWordFormT, i: number) => ({ ...f, id: i })));
    }
    setCommonInfo({ ...commonInfo, generated: true });
    setShortTranslations(short_translations);
  };

  const onClickCommonNext = () => setStep(2);
  const onClickFormsNext = () => setStep(3);
  const onClickMeaningsNext = () => setStep(4);
  const onClickShortNext = () => setStep(5);
  const onClickMeaningTranslationNext = () => setStep(6);

  return (
    <div className={styles.addWordForm}>
      <div className={styles.leftContainer}>
        {step > 0 && (
          <div className={styles.selectedWordTitle}>
            <Title level={5}>{word}</Title>
            <Title level={5}>-</Title>
            <Title level={5}>{partOfSpeech}</Title>
          </div>
        )}
        <Steps
          className={styles.steps}
          orientation="vertical"
          type="dot"
          current={step}
          onChange={setStep}
          items={stepItems}
        />
        {step > 0 && (
          <Button onClick={insertJSON} type="primary">
            {t('insert_json')}
          </Button>
        )}
      </div>
      <div className={styles.content}>
        {step === 0 && (
          <>
            <CheckWordBlock
              checkWord={checkWord}
              word={word}
              setWord={setWord}
              setPartOfSpeech={setPartOfSpeech}
              partOfSpeech={partOfSpeech}
            />
            {statusOfPresence === StatusOfWordPresenceE.present && <WordAlreadyExistBlock word={word} />}
          </>
        )}
        {step === 1 && (
          <CommonWordInfo
            onChange={setCommonInfo}
            commonInfo={commonInfo}
            pos={partOfSpeech as EnPartOfSpeechE}
            clickNext={onClickCommonNext}
          />
        )}
        {step === 2 && (
          <SubForms
            setSubForms={setForms}
            subForms={forms}
            onClickFormsNext={onClickFormsNext}
            pos={partOfSpeech as EnPartOfSpeechE}
          />
        )}
        {step === 3 && (
          <Meanings onClickNext={onClickMeaningsNext} meanings={meanings} setMeanings={setMeanings} />
        )}
        {step === 4 && (
          <ShortTranslations
            onClickNext={onClickShortNext}
            shortTranslations={shortTranslations}
            setShortTranslations={setShortTranslations}
          />
        )}
        {step === 5 && (
          <MeaningsTranslations
            meanings={meanings}
            setMeanings={setMeanings}
            onClickNext={onClickMeaningTranslationNext}
          />
        )}
        {step === 6 && (
          <PreviewWord
            word={{
              ...commonInfo,
              meanings,
              forms,
              short_translations: shortTranslations,
              part_of_speech: partOfSpeech as EnPartOfSpeechE,
              word,
            }}
            mode={mode}
            addWord={addWord}
            editWord={editWord}
          />
        )}
      </div>
    </div>
  );
};
