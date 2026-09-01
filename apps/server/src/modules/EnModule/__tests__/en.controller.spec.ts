import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EnController } from '../en.controller';
import { EnService } from '../en.service';
import { AddWordReqDTO } from '../dto/AddWordReq.dto';
import { CheckWordQueryDTO } from '../dto/CheckWordQuery.dto';
import { EnAreaVariantsE, EnEntryTypesE, EnPartOfSpeechE, EnWordFormsE } from '../../../../types';
import { ErrorCodes } from '../../../../core/constants/error_codes';

describe('EnController (issue #87)', () => {
  let controller: EnController;

  const mockEnService: jest.Mocked<
    Pick<
      EnService,
      | 'checkWord'
      | 'addWord'
      | 'deleteWord'
      | 'editWord'
      | 'editPhrasalBase'
      | 'getWordById'
      | 'addWordForm'
      | 'editWordForm'
    >
  > = {
    checkWord: jest.fn(),
    addWord: jest.fn(),
    deleteWord: jest.fn(),
    editWord: jest.fn(),
    editPhrasalBase: jest.fn(),
    getWordById: jest.fn(),
    addWordForm: jest.fn(),
    editWordForm: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnController],
      providers: [{ provide: EnService, useValue: mockEnService }],
    }).compile();

    controller = module.get<EnController>(EnController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkWord', () => {
    const makeQuery = (forPhrasal?: string): CheckWordQueryDTO =>
      ({ partOfSpeech: EnPartOfSpeechE.verb, forPhrasal }) as CheckWordQueryDTO;

    it('returns hasWord=true with the id when the service finds the word', async () => {
      mockEnService.checkWord.mockResolvedValue(42);

      await expect(controller.checkWord('run', makeQuery())).resolves.toEqual({ hasWord: true, id: 42 });
      expect(mockEnService.checkWord).toHaveBeenCalledWith('run', EnPartOfSpeechE.verb, false);
    });

    it('returns hasWord=false without an id when the word is missing', async () => {
      mockEnService.checkWord.mockResolvedValue(false);

      const res = await controller.checkWord('run', makeQuery());

      expect(res).toEqual({ hasWord: false });
      expect(res).not.toHaveProperty('id');
    });

    it('passes forPhrasal=true only for the literal string "true"', async () => {
      mockEnService.checkWord.mockResolvedValue(false);

      await controller.checkWord('run', makeQuery('true'));
      expect(mockEnService.checkWord).toHaveBeenLastCalledWith('run', EnPartOfSpeechE.verb, true);

      await controller.checkWord('run', makeQuery('false'));
      expect(mockEnService.checkWord).toHaveBeenLastCalledWith('run', EnPartOfSpeechE.verb, false);
    });

    it('wraps service failures into InternalServerErrorException', async () => {
      mockEnService.checkWord.mockRejectedValue(new Error('db is down'));

      await expect(controller.checkWord('run', makeQuery())).rejects.toThrow(InternalServerErrorException);
      await expect(controller.checkWord('run', makeQuery())).rejects.toThrow(ErrorCodes.internal_server_error);
    });
  });

  describe('add', () => {
    it('delegates the body to EnService.addWord and returns its result', async () => {
      const body = { word: 'run' } as AddWordReqDTO;
      mockEnService.addWord.mockResolvedValue(body);

      await expect(controller.add(EnEntryTypesE.word, body)).resolves.toBe(body);
      expect(mockEnService.addWord).toHaveBeenCalledWith(body);
    });

    it('propagates service errors unchanged', async () => {
      mockEnService.addWord.mockRejectedValue(new Error(ErrorCodes.word_already_exists));

      await expect(controller.add(EnEntryTypesE.word, {} as AddWordReqDTO)).rejects.toThrow(
        ErrorCodes.word_already_exists,
      );
    });
  });

  describe('id params arrive as numbers (ParseIntPipe converts them, issue #345)', () => {
    it('deleteWord', async () => {
      mockEnService.deleteWord.mockResolvedValue({ success: true });

      await expect(controller.deleteWord(5)).resolves.toEqual({ success: true });
      expect(mockEnService.deleteWord).toHaveBeenCalledWith(5);
    });

    it('editWord', async () => {
      mockEnService.editWord.mockResolvedValue({ success: true });
      const body = { description: 'to move fast' };

      await controller.editWord(7, body);

      expect(mockEnService.editWord).toHaveBeenCalledWith(7, body);
    });

    it('getWordById', async () => {
      mockEnService.getWordById.mockResolvedValue({ id: 3, word: 'run' } as never);

      await controller.getWordById(3);

      expect(mockEnService.getWordById).toHaveBeenCalledWith(3);
    });
  });

  describe('word form and phrasal base endpoints delegate to the service', () => {
    it('editPhrasalBase', async () => {
      mockEnService.editPhrasalBase.mockResolvedValue({ success: true });
      const body = { id: 1, phrasal_base_id: 2 };

      await expect(controller.editPhrasalBase(body)).resolves.toEqual({ success: true });
      expect(mockEnService.editPhrasalBase).toHaveBeenCalledWith(body);
    });

    it('addWordForm', async () => {
      mockEnService.addWordForm.mockResolvedValue({ success: true, id: 10 });
      const body = {
        word: 'ran',
        form_of_word: EnWordFormsE.past_simple,
        transcription: 'ræn',
        area_variant: EnAreaVariantsE.common,
        base_word_id: 1,
      };

      await expect(controller.addWordForm(body)).resolves.toEqual({ success: true, id: 10 });
      expect(mockEnService.addWordForm).toHaveBeenCalledWith(body);
    });

    it('editWordForm', async () => {
      mockEnService.editWordForm.mockResolvedValue({ success: true });
      const body = { id: 10, word: 'ran' };

      await expect(controller.editWordForm(body)).resolves.toEqual({ success: true });
      expect(mockEnService.editWordForm).toHaveBeenCalledWith(body);
    });
  });
});
