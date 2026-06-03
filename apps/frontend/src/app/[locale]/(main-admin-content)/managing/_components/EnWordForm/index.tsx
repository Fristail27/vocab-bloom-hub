'use client';

import React, { useState } from 'react';
import { Button, Spin, Steps } from 'antd';
import {
  EnMeaningT,
  EnPartOfSpeechE,
  EnShortTranslationT,
  EnWordT,
} from '../../../../../../../../server/types';
import { EnWordFormModeE, DefaultShortTranslation, FormWordT } from './constants';
import { WordAlreadyExistBlock } from './components/WordAlreadyExistBlock';
import { StatusOfWordPresenceE } from './types';
import { Meanings } from './components/Meanings';
import { CommonInfoDataT } from './types';
import { SubForms } from './components/SubForms';
import { CommonWordInfo } from './components/CommonWordInfo';
import { PreviewWord } from './components/PreviewWord';
import { ShortTranslation } from './components/ShortTranslation';
import { MeaningsTranslations } from './components/MeaningsTranslations';
import {
  getInitCommonInfo,
  getInitMeanings,
  getInitShortTranslations,
  mapInitForms,
  getStepItems,
} from './utils';
import { CheckWordBlock } from './components/CheckWordBlock';
import styles from './styles.module.scss';

type AddWordFormP = {
  initData?: EnWordT | undefined;
  mode?: EnWordFormModeE | undefined;
};

export const EnWordForm: React.FC<AddWordFormP> = ({ initData, mode = EnWordFormModeE.add }) => {
  const [step, setStep] = useState<number>(mode === EnWordFormModeE.edit ? 1 : 0);
  const [stepItems, setStepItems] = useState(getStepItems(undefined, mode));
  const [word, setWord] = useState<string>(initData?.word_text || '');
  const [partOfSpeech, setPartOfSpeech] = useState<EnPartOfSpeechE | null>(initData?.part_of_speech || null);
  const [commonInfo, setCommonInfo] = useState<CommonInfoDataT>(getInitCommonInfo(initData));
  const [shortTranslation, setShortTranslation] = useState<EnShortTranslationT>(
    getInitShortTranslations(initData?.shortTranslations) || DefaultShortTranslation,
  );
  const [meanings, setMeanings] = useState<EnMeaningT[]>(getInitMeanings(initData?.meanings) || []);
  const [forms, setForms] = useState<FormWordT[]>(mapInitForms(initData?.forms || []));
  const [statusOfPresence, setStatusOfPresence] = useState<StatusOfWordPresenceE>(
    StatusOfWordPresenceE.notChecked,
  );
  const [isLoading] = useState<boolean>(false);
  const [wordIsChecked, setWordIsChecked] = useState<boolean>(mode !== EnWordFormModeE.edit);

  const addWord = async () => {
    try {
      // if (partOfSpeech) {
      //   let body: any = {
      //     word,
      //     part_of_speech: partOfSpeech,
      //     meanings: meanings.map(({ id, translation, ...m }) => ({
      //       ...m,
      //       translation: translation.map(({ id, ...t }) => ({ ...t })),
      //     })),
      //     shortTranslations: [shortTranslation],
      //     forms: forms.map(({ id, languageRegister, ...f }) => f),
      //     ...commonInfo,
      //   };
      //   if (body) {
      //     body.forms = body.forms.filter((c: any) => c.word.length > 0);
      //     const res = await EnWordsApi.addWord(body);
      //
      //     if (res.success) {
      //       message.success('Слово успешно добавлено');
      //       setWord('');
      //       setStatusOfPresence(StatusOfWordPresenceE.notChecked);
      //       setShortTranslation(DefaultShortTranslation);
      //       setPartOfSpeech(null);
      //       setCommonInfo(DefaultCommonData);
      //       setForms([]);
      //       setMeanings([]);
      //       setStep(0);
      //       setStepItems(getStepItems(undefined, mode));
      //     } else {
      //       message.error('Не удалось добавить слово');
      //     }
      //   }
      // }
    } catch (err) {
      console.log(err);
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
    // if (partOfSpeech || newPartOfSpeech) {
    //   const { hasWord } = await EnWordsApi.checkWord(
    //     newWord || word,
    //     (newPartOfSpeech || partOfSpeech) as PartOfSpeechE,
    //   );
    //   if (hasWord) {
    //     setStatusOfPresence(StatusOfWordPresenceE.present);
    //   } else {
    setStatusOfPresence(StatusOfWordPresenceE.absent);
    setStep(1);
    setStepItems(getStepItems({ word, pos: partOfSpeech as EnPartOfSpeechE }, mode));
    //     return true;
    //   }
    // }
  };
  const insertJSON = async () => {
    const te = await navigator.clipboard.readText();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { meanings, forms, shortTranslation, word: w, part_of_speech: p, ...commonInfo } = JSON.parse(te);
    setMeanings(
      meanings.map((m: EnMeaningT, i: number) => ({
        ...m,
        id: i,
        translation: m.translation.map((t, ind: number) => ({ ...t, id: ind })),
      })),
    );
    if (forms) {
      setForms(forms.map((f: FormWordT, i: number) => ({ ...f, id: i })));
    }
    setCommonInfo({ ...commonInfo, generated: true });
    setShortTranslation(shortTranslation);
  };

  const onClickCommonNext = () => setStep(2);
  const onClickFormsNext = () => setStep(3);
  const onClickMeaningsNext = () => setStep(4);
  const onClickShortNext = () => setStep(5);
  const onClickMeaningTranslationNext = () => setStep(6);

  return (
    <Spin spinning={isLoading}>
      <div className={styles.addWordForm}>
        <div>
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
              Вставить json
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
            <ShortTranslation
              onClickNext={onClickShortNext}
              shortTranslation={shortTranslation}
              setShortTranslation={setShortTranslation}
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
              addWord={addWord}
              mode={mode}
              editWord={editWord}
              wordIsChecked={wordIsChecked}
              setWordIsChecked={setWordIsChecked}
            />
          )}
        </div>
      </div>
    </Spin>
  );
};
