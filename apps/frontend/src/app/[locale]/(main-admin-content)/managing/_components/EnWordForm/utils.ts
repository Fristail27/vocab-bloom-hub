import { EnAreaVariantsE, EnWordFormsE, EnWordFormT, EnWordT } from 'server/types';
import { TranslatorT } from '@/types/common';

// Temporary client-side keys for not-yet-persisted items: negative integers can
// never collide with real DB ids and are easy to detect and strip before submit
let tempIdCounter = 0;
export const makeTempId = (): number => --tempIdCounter;

export const isTempId = (id: number | undefined): boolean => typeof id === 'number' && id < 0;

const stripTempId = <T extends { id: number }>(item: T): T => {
  if (!isTempId(item.id)) return item;
  const { id: _id, ...rest } = item;
  return rest as unknown as T;
};

// The server assigns real ids itself; temp keys must not leak into the payload
export const prepareWordPayload = (body: EnWordT): EnWordT => ({
  ...body,
  forms: body.forms?.map(stripTempId),
  short_translations: body.short_translations?.map(stripTempId),
  meanings: body.meanings?.map((m) => ({
    ...stripTempId(m),
    translations: m.translations?.map(stripTempId),
  })),
});

export const getDefaultSubForm = (key: EnWordFormsE): EnWordFormT => {
  return {
    word: '',
    area_variant: EnAreaVariantsE.common,
    transcription: '',
    id: makeTempId(),
    form_of_word: key,
  };
};

export const getStepItems = (t: TranslatorT, allDisabled: boolean = false) => {
  return [
    { title: t('checking_word'), disabled: true },
    { title: t('basic_information'), disabled: allDisabled },
    { title: t('word_forms'), disabled: allDisabled },
    { title: t('word_meanings'), disabled: allDisabled },
    { title: t('short_translations'), disabled: allDisabled },
    { title: t('meaning_translations'), disabled: allDisabled },
    { title: t('save_word'), disabled: allDisabled },
  ];
};
