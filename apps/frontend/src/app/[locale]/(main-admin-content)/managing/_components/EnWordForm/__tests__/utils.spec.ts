import {
  CustomVersionDictionaryOfWord,
  EnAreaVariantsE,
  EnMeaningT,
  EnWordFormsE,
  EnWordFormT,
  EnWordT,
  WordLevelE,
} from 'server/types';
import { getDefaultSubForm, getInitCommonInfo, getInitMeanings, getStepItems, mapInitForms } from '../utils';
import { DefaultCommonData, EnWordFormModeE } from '../constants';
import { TranslatorT } from '@/types/common';

const identityT = ((key: string) => key) as unknown as TranslatorT;

describe('EnWordForm/utils', () => {
  describe('getDefaultSubForm', () => {
    it('создаёт пустую форму с указанным типом', () => {
      const form = getDefaultSubForm(EnWordFormsE.past_simple);

      expect(form).toMatchObject({
        word: '',
        transcription: '',
        area_variant: EnAreaVariantsE.common,
        form_of_word: EnWordFormsE.past_simple,
      });
      expect(typeof form.id).toBe('number');
    });
  });

  describe('getInitCommonInfo', () => {
    it('возвращает дефолтные данные без слова', () => {
      expect(getInitCommonInfo(undefined)).toBe(DefaultCommonData);
    });

    it('мапит поля слова и нормализует null/undefined', () => {
      const word = {
        id: 7,
        form_of_word: EnWordFormsE.base_form,
        verb___is_phrasal: null,
        verb___is_irregular: true,
        transcription: null,
        description: null,
        is_obsolete: null,
        word_level: null,
        noun___irregular_plural: null,
        noun___is_proper: null,
        noun___uncountable: null,
        base_phrasal: null,
      } as unknown as EnWordT;

      const info = getInitCommonInfo(word);

      expect(info).toMatchObject({
        id: 7,
        version: CustomVersionDictionaryOfWord,
        verb___is_phrasal: false,
        verb___is_irregular: true,
        transcription: '',
        description: '',
        is_obsolete: false,
        word_level: null,
        noun___irregular_plural: false,
        noun___is_proper: false,
        noun___uncountable: false,
        base_phrasal: undefined,
      });
    });

    it('сохраняет заполненные значения', () => {
      const word = {
        id: 8,
        form_of_word: EnWordFormsE.base_form,
        transcription: 'rʌn',
        description: 'desc',
        word_level: WordLevelE.B2,
      } as unknown as EnWordT;

      const info = getInitCommonInfo(word);

      expect(info.transcription).toBe('rʌn');
      expect(info.description).toBe('desc');
      expect(info.word_level).toBe(WordLevelE.B2);
    });
  });

  describe('mapInitForms', () => {
    it('оставляет только нужные поля и нормализует transcription', () => {
      const forms = [
        {
          id: 1,
          word: 'ran',
          area_variant: EnAreaVariantsE.common,
          transcription: null,
          form_of_word: EnWordFormsE.past_simple,
          extra_field: 'dropped',
        },
      ] as unknown as EnWordFormT[];

      expect(mapInitForms(forms)).toEqual([
        {
          id: 1,
          word: 'ran',
          area_variant: EnAreaVariantsE.common,
          transcription: '',
          form_of_word: EnWordFormsE.past_simple,
        },
      ]);
    });
  });

  describe('getInitMeanings', () => {
    it('сортирует по sort_order и не мутирует исходный массив', () => {
      const meanings = [
        { id: 2, sort_order: 2, translations: [] },
        { id: 1, sort_order: 1, translations: [{ id: 10 }] },
      ] as unknown as EnMeaningT[];

      const res = getInitMeanings(meanings);

      expect(res.map((m) => m.id)).toEqual([1, 2]);
      expect(meanings.map((m) => m.id)).toEqual([2, 1]);
    });

    it('возвращает пустой массив без аргумента', () => {
      expect(getInitMeanings()).toEqual([]);
    });
  });

  describe('getStepItems', () => {
    it('в режиме add добавляет отключённый шаг проверки слова в начало', () => {
      const steps = getStepItems(identityT, EnWordFormModeE.add);

      expect(steps).toHaveLength(7);
      expect(steps[0]).toEqual({ title: 'checking_word', disabled: true });
      expect(steps[1].title).toBe('basic_information');
    });

    it('в режиме edit шага проверки нет', () => {
      const steps = getStepItems(identityT, EnWordFormModeE.edit);

      expect(steps).toHaveLength(6);
      expect(steps[0].title).toBe('basic_information');
      expect(steps.every((s) => !s.disabled)).toBe(true);
    });

    it('allDisabled отключает все шаги', () => {
      const steps = getStepItems(identityT, EnWordFormModeE.edit, true);

      expect(steps.every((s) => s.disabled)).toBe(true);
    });
  });
});
