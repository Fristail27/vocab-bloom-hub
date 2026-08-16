import '../../../__tests__/helpers/clearDatabaseUrl';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';
import { EnMeaningService } from '../enMeaning.service';
import { EnMeaningTranslationService } from '../../EnMeaningTranslation/enMeaningTranslation.service';
import { AddMeaningReqDTO } from '../dto/AddMeaningReq.dto';
import {
  AvailableTranslationLanguagesE,
  CategoryE,
  EnAreaVariantsE,
  EnEntryTypesE,
  EnPartOfSpeechE,
  EnWordFormsE,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../../../types';

describe('EnMeaningService (issue #87)', () => {
  let ds: DataSource;
  let service: EnMeaningService;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation],
      synchronize: true,
      // mirrors AppModule: cascade deletes rely on this pragma
      prepareDatabase: (db) => {
        db.pragma('foreign_keys = ON');
      },
    });
    await ds.initialize();

    const meaningTranslationService = new EnMeaningTranslationService(
      ds.getRepository(EnMeaning),
      ds.getRepository(EnMeaningTranslation),
    );
    service = new EnMeaningService(
      ds.getRepository(EnWord),
      ds.getRepository(EnMeaning),
      meaningTranslationService,
    );
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.synchronize(true);
  });

  const addWordRow = async (word = 'run'): Promise<EnWord> => {
    const entry = await ds.getRepository(EnEntry).save({ word, type: EnEntryTypesE.word });
    return ds.getRepository(EnWord).save({
      word: entry,
      part_of_speech: EnPartOfSpeechE.verb,
      form_of_word: EnWordFormsE.base_form,
    });
  };

  const makeAddBody = (word_id: number, extra: Partial<AddMeaningReqDTO> = {}): AddMeaningReqDTO =>
    ({
      word_id,
      title: 'to move fast',
      definition: 'to move fast on foot',
      examples: ['I run every morning'],
      sort_order: 1,
      is_obsolete: false,
      meaning_level: WordLevelE.A1,
      area_variant: EnAreaVariantsE.common,
      language_register: LanguageRegisterE.informal,
      categories: [CategoryE.sport],
      translations: [],
      ...extra,
    }) as AddMeaningReqDTO;

  // AddMeaningResT is a union with ErrorResT; the service throws instead of returning error objects
  const addedId = (res: Awaited<ReturnType<EnMeaningService['addMeaning']>>): number =>
    (res as { id: number }).id;

  describe('addMeaning', () => {
    it('creates a meaning attached to the word and returns its id', async () => {
      const word = await addWordRow();

      const res = await service.addMeaning(makeAddBody(word.id));

      expect(res).toEqual({ success: true, id: expect.any(Number) });
      const saved = await ds.getRepository(EnMeaning).findOneOrFail({
        where: { id: addedId(res) },
        relations: { word: true },
      });
      expect(saved.word.id).toBe(word.id);
      expect(saved.title).toBe('to move fast');
      expect(saved.examples).toEqual(['I run every morning']);
      expect(saved.categories).toEqual([CategoryE.sport]);
      expect(saved.language_register).toBe(LanguageRegisterE.informal);
    });

    it('creates the nested translations through the translation service', async () => {
      const word = await addWordRow();

      const res = await service.addMeaning(
        makeAddBody(word.id, {
          translations: [
            {
              language: AvailableTranslationLanguagesE.ru,
              title: 'бежать',
              definition: 'быстро перемещаться',
              variants_of_words: ['бежать'],
            },
          ] as AddMeaningReqDTO['translations'],
        }),
      );

      const translations = await ds.getRepository(EnMeaningTranslation).find({
        relations: { meaning: true },
      });
      expect(translations).toHaveLength(1);
      expect(translations[0].meaning.id).toBe(addedId(res));
      expect(translations[0].title).toBe('бежать');
    });

    it('throws NotFoundException for a missing word and creates nothing', async () => {
      await expect(service.addMeaning(makeAddBody(9999))).rejects.toThrow(NotFoundException);

      expect(await ds.getRepository(EnMeaning).count()).toBe(0);
    });
  });

  describe('editMeaning', () => {
    it('updates the changed fields', async () => {
      const word = await addWordRow();
      const id = addedId(await service.addMeaning(makeAddBody(word.id)));

      const res = await service.editMeaning({
        id,
        title: 'to jog',
        definition: 'to run at a slow pace',
        sort_order: 2,
        meaning_level: WordLevelE.B2,
        area_variant: EnAreaVariantsE.british,
        examples: ['He jogs daily'],
        categories: [CategoryE.medical],
      });

      expect(res).toEqual({ success: true });
      const updated = await ds.getRepository(EnMeaning).findOneByOrFail({ id });
      expect(updated.title).toBe('to jog');
      expect(updated.definition).toBe('to run at a slow pace');
      expect(updated.sort_order).toBe(2);
      expect(updated.meaning_level).toBe(WordLevelE.B2);
      expect(updated.area_variant).toBe(EnAreaVariantsE.british);
      expect(updated.examples).toEqual(['He jogs daily']);
      expect(updated.categories).toEqual([CategoryE.medical]);
    });

    it('keeps the stored language_register when the field is omitted and clears it on explicit null', async () => {
      const word = await addWordRow();
      const id = addedId(await service.addMeaning(makeAddBody(word.id)));

      await service.editMeaning({ id, title: 'to sprint' });
      expect((await ds.getRepository(EnMeaning).findOneByOrFail({ id })).language_register).toBe(
        LanguageRegisterE.informal,
      );

      await service.editMeaning({ id, language_register: null });
      expect((await ds.getRepository(EnMeaning).findOneByOrFail({ id })).language_register).toBeNull();
    });

    it('updates examples even when the stored row has examples = NULL', async () => {
      const word = await addWordRow();
      const meaning = await ds.getRepository(EnMeaning).save({
        word,
        title: 'imported meaning',
        definition: 'imported without examples',
        sort_order: 1,
        examples: null as unknown as string[],
      });

      await service.editMeaning({ id: meaning.id, examples: ['brand new example'] });

      const updated = await ds.getRepository(EnMeaning).findOneByOrFail({ id: meaning.id });
      expect(updated.examples).toEqual(['brand new example']);
    });

    it('throws NotFoundException for a missing meaning', async () => {
      await expect(service.editMeaning({ id: 9999, title: 'nope' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMeaning', () => {
    it('removes the meaning together with its translations', async () => {
      const word = await addWordRow();
      const id = addedId(
        await service.addMeaning(
          makeAddBody(word.id, {
            translations: [
              {
                language: AvailableTranslationLanguagesE.ru,
                title: 'бежать',
                definition: 'быстро перемещаться',
                variants_of_words: ['бежать'],
              },
            ] as AddMeaningReqDTO['translations'],
          }),
        ),
      );

      const res = await service.deleteMeaning(id);

      expect(res).toEqual({ success: true });
      expect(await ds.getRepository(EnMeaning).count()).toBe(0);
      // FK cascade wipes the orphaned translations
      expect(await ds.getRepository(EnMeaningTranslation).count()).toBe(0);
      // the word itself survives
      expect(await ds.getRepository(EnWord).count()).toBe(1);
    });

    it('reports success for a missing id (idempotent delete)', async () => {
      await expect(service.deleteMeaning(9999)).resolves.toEqual({ success: true });
    });
  });
});
