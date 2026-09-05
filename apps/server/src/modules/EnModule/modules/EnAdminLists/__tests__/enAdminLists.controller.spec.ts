import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { EnAdminListsController } from '../enAdminLists.controller';
import { EnAdminListsService } from '../enAdminLists.service';
import { AdminGuard } from '../../../../AuthModule/guards/admin.guard';
import {
  AvailableTranslationLanguagesE,
  EnMeaningsListT,
  EnMeaningTranslationsListT,
  EnPartOfSpeechE,
  EnShortTranslationsListT,
  EnWordsListT,
  WordLevelE,
} from '../../../../../../types';

describe('EnAdminListsController (issue #249)', () => {
  let controller: EnAdminListsController;
  const mockService: jest.Mocked<
    Pick<
      EnAdminListsService,
      'listWords' | 'listMeanings' | 'listMeaningTranslations' | 'listShortTranslations'
    >
  > = {
    listWords: jest.fn(),
    listMeanings: jest.fn(),
    listMeaningTranslations: jest.fn(),
    listShortTranslations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnAdminListsController],
      providers: [{ provide: EnAdminListsService, useValue: mockService }],
    }).compile();
    controller = module.get(EnAdminListsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates the validated words query to the service and returns its result', async () => {
    const result: EnWordsListT = { items: [], page: 2, limit: 10, total: 0, has_more: false };
    mockService.listWords.mockResolvedValue(result);
    const query = { page: 2, limit: 10, part_of_speech: [EnPartOfSpeechE.noun] };

    await expect(controller.listWords(query)).resolves.toBe(result);
    expect(mockService.listWords).toHaveBeenCalledWith(query);
  });

  it('delegates the meanings query', async () => {
    const result: EnMeaningsListT = { items: [], page: 1, limit: 50, total: 0, has_more: false };
    mockService.listMeanings.mockResolvedValue(result);
    const query = { meaning_level: [WordLevelE.B1], has_translations: false };

    await expect(controller.listMeanings(query)).resolves.toBe(result);
    expect(mockService.listMeanings).toHaveBeenCalledWith(query);
  });

  it('delegates the meaning translations query', async () => {
    const result: EnMeaningTranslationsListT = { items: [], page: 1, limit: 50, total: 0, has_more: false };
    mockService.listMeaningTranslations.mockResolvedValue(result);
    const query = { language: [AvailableTranslationLanguagesE.ru] };

    await expect(controller.listMeaningTranslations(query)).resolves.toBe(result);
    expect(mockService.listMeaningTranslations).toHaveBeenCalledWith(query);
  });

  it('delegates the short translations query', async () => {
    const result: EnShortTranslationsListT = { items: [], page: 1, limit: 50, total: 0, has_more: false };
    mockService.listShortTranslations.mockResolvedValue(result);
    const query = { language: [AvailableTranslationLanguagesE.ru], search: 'ru' };

    await expect(controller.listShortTranslations(query)).resolves.toBe(result);
    expect(mockService.listShortTranslations).toHaveBeenCalledWith(query);
  });

  it('protects every listing with the AdminGuard', () => {
    for (const handler of [
      controller.listWords,
      controller.listMeanings,
      controller.listMeaningTranslations,
      controller.listShortTranslations,
    ]) {
      const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
      expect(guards).toContain(AdminGuard);
    }
  });
});
