import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

import { EnMeaningController } from '../modules/EnMeaning/enMeaning.controller';
import { EnMeaningService } from '../modules/EnMeaning/enMeaning.service';
import { AddMeaningReqDTO } from '../modules/EnMeaning/dto/AddMeaningReq.dto';
import { EnMeaningTranslationController } from '../modules/EnMeaningTranslation/enMeaningTranslation.controller';
import { EnMeaningTranslationService } from '../modules/EnMeaningTranslation/enMeaningTranslation.service';
import { AddMeaningTranslationReqDTO } from '../modules/EnMeaningTranslation/dto/AddMeaningTranslationReq.dto';
import { EnShortTranslationController } from '../modules/EnShortTranslation/enShortTranslation.controller';
import { EnShortTranslationService } from '../modules/EnShortTranslation/enShortTranslation.service';
import { AddShortTranslationReqDTO } from '../modules/EnShortTranslation/dto/AddShortTranslationReq.dto';

describe('word sub-resource controllers (issue #87)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('EnMeaningController', () => {
    let controller: EnMeaningController;
    const mockService: jest.Mocked<Pick<EnMeaningService, 'addMeaning' | 'editMeaning' | 'deleteMeaning'>> = {
      addMeaning: jest.fn(),
      editMeaning: jest.fn(),
      deleteMeaning: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [EnMeaningController],
        providers: [{ provide: EnMeaningService, useValue: mockService }],
      }).compile();
      controller = module.get(EnMeaningController);
    });

    it('addMeaning delegates the body and returns the service result', async () => {
      const body = { word_id: 1, title: 'to move fast' } as AddMeaningReqDTO;
      mockService.addMeaning.mockResolvedValue({ success: true, id: 5 });

      await expect(controller.addMeaning(body)).resolves.toEqual({ success: true, id: 5 });
      // the controller must not pass a manager — sub-services fall back to their own one
      expect(mockService.addMeaning).toHaveBeenCalledWith(body);
    });

    it('editMeaning delegates the body', async () => {
      const body = { id: 5, title: 'to jog' };
      mockService.editMeaning.mockResolvedValue({ success: true });

      await expect(controller.editMeaning(body)).resolves.toEqual({ success: true });
      expect(mockService.editMeaning).toHaveBeenCalledWith(body);
    });

    it('deleteMeaning converts the id param to a number', async () => {
      mockService.deleteMeaning.mockResolvedValue({ success: true });

      await expect(controller.deleteMeaning('5')).resolves.toEqual({ success: true });
      expect(mockService.deleteMeaning).toHaveBeenCalledWith(5);
    });
  });

  describe('EnMeaningTranslationController', () => {
    let controller: EnMeaningTranslationController;
    const mockService: jest.Mocked<
      Pick<
        EnMeaningTranslationService,
        'addMeaningTranslation' | 'editMeaningTranslation' | 'deleteMeaningTranslation'
      >
    > = {
      addMeaningTranslation: jest.fn(),
      editMeaningTranslation: jest.fn(),
      deleteMeaningTranslation: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [EnMeaningTranslationController],
        providers: [{ provide: EnMeaningTranslationService, useValue: mockService }],
      }).compile();
      controller = module.get(EnMeaningTranslationController);
    });

    it('addMeaningTranslation delegates the body and returns the service result', async () => {
      const body = { meaning_id: 1, title: 'бежать' } as AddMeaningTranslationReqDTO;
      mockService.addMeaningTranslation.mockResolvedValue({ success: true, id: 7 });

      await expect(controller.addMeaningTranslation(body)).resolves.toEqual({ success: true, id: 7 });
      expect(mockService.addMeaningTranslation).toHaveBeenCalledWith(body);
    });

    it('editMeaningTranslation delegates the body', async () => {
      const body = { id: 7, title: 'мчаться' };
      mockService.editMeaningTranslation.mockResolvedValue({ success: true });

      await expect(controller.editMeaningTranslation(body)).resolves.toEqual({ success: true });
      expect(mockService.editMeaningTranslation).toHaveBeenCalledWith(body);
    });

    it('deleteMeaningTranslation converts the id param to a number', async () => {
      mockService.deleteMeaningTranslation.mockResolvedValue({ success: true });

      await expect(controller.deleteMeaningTranslation('7')).resolves.toEqual({ success: true });
      expect(mockService.deleteMeaningTranslation).toHaveBeenCalledWith(7);
    });
  });

  describe('EnShortTranslationController', () => {
    let controller: EnShortTranslationController;
    const mockService: jest.Mocked<
      Pick<EnShortTranslationService, 'addShortTranslation' | 'editShortTranslation' | 'deleteShortTranslation'>
    > = {
      addShortTranslation: jest.fn(),
      editShortTranslation: jest.fn(),
      deleteShortTranslation: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [EnShortTranslationController],
        providers: [{ provide: EnShortTranslationService, useValue: mockService }],
      }).compile();
      controller = module.get(EnShortTranslationController);
    });

    it('addShortTranslation delegates the body and returns the service result', async () => {
      const body = { word_id: 1, description: 'бежать' } as AddShortTranslationReqDTO;
      mockService.addShortTranslation.mockResolvedValue({ success: true, id: 9 });

      await expect(controller.addShortTranslation(body)).resolves.toEqual({ success: true, id: 9 });
      expect(mockService.addShortTranslation).toHaveBeenCalledWith(body);
    });

    it('editShortTranslation delegates the body', async () => {
      const body = { id: 9, description: 'мчаться' };
      mockService.editShortTranslation.mockResolvedValue({ success: true });

      await expect(controller.editShortTranslation(body)).resolves.toEqual({ success: true });
      expect(mockService.editShortTranslation).toHaveBeenCalledWith(body);
    });

    it('deleteShortTranslation converts the id param to a number', async () => {
      mockService.deleteShortTranslation.mockResolvedValue({ success: true });

      await expect(controller.deleteShortTranslation('9')).resolves.toEqual({ success: true });
      expect(mockService.deleteShortTranslation).toHaveBeenCalledWith(9);
    });
  });
});
