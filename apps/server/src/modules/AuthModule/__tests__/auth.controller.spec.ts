import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const FAKE_TOKEN = 'fake.jwt.token';

  // Мок всего сервиса
  const mockAuthService: jest.Mocked<
    Pick<AuthService, 'login' | 'checkToken' | 'createJwtToken' | 'setTokenToCookie'>
  > = {
    login: jest.fn(),
    checkToken: jest.fn(),
    createJwtToken: jest.fn(),
    setTokenToCookie: jest.fn(),
  };

  // Хелперы для моков req/res
  const makeRes = (): jest.Mocked<Response> => ({ cookie: jest.fn() }) as any;

  const makeReq = (authHeader?: string): Partial<Request> => ({
    headers: {
      authorization: authHeader,
    } as any,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /login ──────────────────────────────────────────────────────────

  describe('login', () => {
    it('возвращает { token } при успешной авторизации', async () => {
      mockAuthService.login.mockResolvedValue(FAKE_TOKEN);
      const res = makeRes();

      const result = await controller.login({ hash: 'correct-hash' }, res);

      expect(result).toEqual({ token: FAKE_TOKEN });
    });

    it('вызывает setTokenToCookie с полученным токеном', async () => {
      mockAuthService.login.mockResolvedValue(FAKE_TOKEN);
      const res = makeRes();

      await controller.login({ hash: 'correct-hash' }, res);

      expect(mockAuthService.setTokenToCookie).toHaveBeenCalledWith(FAKE_TOKEN, res);
    });

    it('пробрасывает ошибку от authService.login', async () => {
      mockAuthService.login.mockRejectedValue(new Error('login or password is wrong'));
      const res = makeRes();

      await expect(controller.login({ hash: 'wrong-hash' }, res)).rejects.toThrow('login or password is wrong');
    });

    it('не вызывает setTokenToCookie при ошибке логина', async () => {
      mockAuthService.login.mockRejectedValue(new Error('bad credentials'));
      const res = makeRes();

      await controller.login({ hash: 'wrong' }, res).catch(() => {});

      expect(mockAuthService.setTokenToCookie).not.toHaveBeenCalled();
    });
  });

  // ─── GET /check-token ─────────────────────────────────────────────────────

  describe('checkToken', () => {
    it('возвращает { isValid: false } если нет заголовка Authorization', async () => {
      const req = makeReq(undefined);
      const res = makeRes();

      const result = await controller.checkToken(req as Request, res);

      expect(result).toEqual({ isValid: false });
      expect(mockAuthService.checkToken).not.toHaveBeenCalled();
    });

    it('возвращает { isValid: true } и обновляет куку при валидном токене', async () => {
      mockAuthService.checkToken.mockResolvedValue(true);
      mockAuthService.createJwtToken.mockResolvedValue(FAKE_TOKEN);

      const req = makeReq(`Bearer ${FAKE_TOKEN}`);
      const res = makeRes();

      const result = await controller.checkToken(req as Request, res);

      expect(result).toEqual({ isValid: true });
      expect(mockAuthService.createJwtToken).toHaveBeenCalled();
      expect(mockAuthService.setTokenToCookie).toHaveBeenCalledWith(FAKE_TOKEN, res);
    });

    it('возвращает { isValid: false } и не обновляет куку при невалидном токене', async () => {
      mockAuthService.checkToken.mockResolvedValue(false);

      const req = makeReq('Bearer bad.token');
      const res = makeRes();

      const result = await controller.checkToken(req as Request, res);

      expect(result).toEqual({ isValid: false });
      expect(mockAuthService.createJwtToken).not.toHaveBeenCalled();
      expect(mockAuthService.setTokenToCookie).not.toHaveBeenCalled();
    });

    it('обрезает "Bearer " из заголовка перед передачей в checkToken', async () => {
      mockAuthService.checkToken.mockResolvedValue(true);
      mockAuthService.createJwtToken.mockResolvedValue(FAKE_TOKEN);

      const req = makeReq(`Bearer ${FAKE_TOKEN}`);
      const res = makeRes();

      await controller.checkToken(req as Request, res);

      // сервис должен получить чистый токен без "Bearer "
      expect(mockAuthService.checkToken).toHaveBeenCalledWith(FAKE_TOKEN);
    });
  });
});
