import { EnAreaVariantsE, EnWordFormsE, EnWordT } from 'server/types';
import { getDefaultSubForm, getStepItems, isTempId, makeTempId, prepareWordPayload } from '../utils';
import { TranslatorT } from '@/types/common';

const identityT = ((key: string) => key) as unknown as TranslatorT;

describe('EnWordForm/utils', () => {
  describe('getDefaultSubForm', () => {
    it('создаёт пустую форму с указанным типом и временным id', () => {
      const form = getDefaultSubForm(EnWordFormsE.past_simple);

      expect(form).toMatchObject({
        word: '',
        transcription: '',
        area_variant: EnAreaVariantsE.common,
        form_of_word: EnWordFormsE.past_simple,
      });
      expect(isTempId(form.id)).toBe(true);
    });
  });

  describe('makeTempId (issue #178)', () => {
    it('выдаёт уникальные отрицательные целые', () => {
      const ids = [makeTempId(), makeTempId(), makeTempId()];

      ids.forEach((id) => {
        expect(Number.isInteger(id)).toBe(true);
        expect(id).toBeLessThan(0);
      });
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('prepareWordPayload (issue #178)', () => {
    it('вычищает временные id (включая вложенные переводы), сохраняя реальные', () => {
      const body = {
        word: 'run',
        forms: [
          { id: makeTempId(), word: 'runs' },
          { id: 42, word: 'ran' },
        ],
        short_translations: [{ id: makeTempId(), description: 'бежать' }],
        meanings: [
          {
            id: makeTempId(),
            title: 'to move fast',
            translations: [
              { id: makeTempId(), title: 'бежать' },
              { id: 7, title: 'старый' },
            ],
          },
          { id: 10, title: 'persisted', translations: [] },
        ],
      } as unknown as EnWordT;

      const payload = prepareWordPayload(body);

      expect(payload.forms?.[0]).not.toHaveProperty('id');
      expect(payload.forms?.[1].id).toBe(42);
      expect(payload.short_translations?.[0]).not.toHaveProperty('id');
      expect(payload.meanings?.[0]).not.toHaveProperty('id');
      expect(payload.meanings?.[0].translations[0]).not.toHaveProperty('id');
      expect(payload.meanings?.[0].translations[1].id).toBe(7);
      expect(payload.meanings?.[1].id).toBe(10);
      // the original body must stay untouched — the wizard state still needs its keys
      expect(body.forms?.[0].id).toBeLessThan(0);
    });
  });

  describe('getStepItems', () => {
    it('starts with a permanently disabled word-checking step (issue #188)', () => {
      const steps = getStepItems(identityT);

      expect(steps).toHaveLength(7);
      expect(steps[0]).toEqual({ title: 'checking_word', disabled: true });
      expect(steps[1].title).toBe('basic_information');
      expect(steps.slice(1).every((s) => !s.disabled)).toBe(true);
    });

    it('disables every step when allDisabled is set', () => {
      const steps = getStepItems(identityT, true);

      expect(steps.every((s) => s.disabled)).toBe(true);
    });
  });
});
