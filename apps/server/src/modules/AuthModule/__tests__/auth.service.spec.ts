import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { BadRequestException } from '@nestjs/common';

import { hashLoginString } from '../../../../core/utils/crypto';
import { AuthService } from '../auth.service';

// Мокаем crypto и auth утилиты
jest.mock('../../../../core/utils/crypto');
jest.mock('../../../../core/utils/auth');

import { createJwt, validateJwt } from '../../../../core/utils/auth';

const mockHashLoginString = hashLoginString as jest.MockedFunction<
  typeof hashLoginString
>;
const mockCreateJwt = createJwt as jest.MockedFunction<typeof createJwt>;
const mockValidateJwt = validateJwt as jest.MockedFunction<typeof validateJwt>;

describe('AuthService', () => {
  let service: AuthService;

  const ENV_USERNAME = 'admin';
  const ENV_PASSWORD = 'secret';
  const FAKE_LOGIN_HASH = 'fake-login-hash';
  const FAKE_SECRET_HASH = 'fake-secret-hash';
  const FAKE_TOKEN = 'fake.jwt.token';

  beforeAll(() => {
    process.env.USERNAME = ENV_USERNAME;
    process.env.PASSWORD = ENV_PASSWORD;
  });

  beforeEach(() => {
    service = new AuthService();

    // hashLoginString вызывается дважды в getLoginHash:
    // 1й вызов: hash(username, pass)      → loginHash
    // 2й вызов: hash(username, loginHash) → secretHash
    mockHashLoginString
      .mockResolvedValueOnce(FAKE_LOGIN_HASH)
      .mockResolvedValueOnce(FAKE_SECRET_HASH);

    mockCreateJwt.mockReturnValue(FAKE_TOKEN);
    mockValidateJwt.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('возвращает JWT при правильном хэше', async () => {
      const result = await service.login(FAKE_LOGIN_HASH);

      expect(result).toBe(FAKE_TOKEN);
      expect(mockCreateJwt).toHaveBeenCalledWith(
        { username: ENV_USERNAME, roles: expect.any(Array) },
        FAKE_SECRET_HASH + FAKE_LOGIN_HASH,
      );
    });

    it('бросает BadRequestException при неверном хэше', async () => {
      await expect(service.login('wrong-hash')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockCreateJwt).not.toHaveBeenCalled();
    });

    it('бросает ошибку с нужным сообщением', async () => {
      await expect(service.login('wrong-hash')).rejects.toThrow(
        'login or password is wrong',
      );
    });
  });

  // ─── createJwtToken ───────────────────────────────────────────────────────

  describe('createJwtToken', () => {
    it('возвращает JWT-строку', async () => {
      const token = await service.createJwtToken();
      expect(typeof token).toBe('string');
      expect(token).toBe(FAKE_TOKEN);
    });

    it('передаёт username и roles в createJwt', async () => {
      await service.createJwtToken();

      expect(mockCreateJwt).toHaveBeenCalledWith(
        { username: ENV_USERNAME, roles: expect.arrayContaining(['admin']) },
        expect.any(String),
      );
    });

    it('подписывает токен склейкой secretHash + loginHash', async () => {
      await service.createJwtToken();

      const [, secret] = mockCreateJwt.mock.calls[0];
      expect(secret).toBe(FAKE_SECRET_HASH + FAKE_LOGIN_HASH);
    });
  });

  // ─── checkToken ───────────────────────────────────────────────────────────

  describe('checkToken', () => {
    it('возвращает true для валидного токена', async () => {
      // hashLoginString снова нужно настроить — предыдущие вызовы уже израсходованы
      mockHashLoginString
        .mockResolvedValueOnce(FAKE_LOGIN_HASH)
        .mockResolvedValueOnce(FAKE_SECRET_HASH);

      mockValidateJwt.mockReturnValue(true);

      const result = await service.checkToken(FAKE_TOKEN);
      expect(result).toBe(true);
    });

    it('возвращает false для невалидного токена', async () => {
      mockHashLoginString
        .mockResolvedValueOnce(FAKE_LOGIN_HASH)
        .mockResolvedValueOnce(FAKE_SECRET_HASH);

      mockValidateJwt.mockReturnValue(false);

      const result = await service.checkToken('bad.token');
      expect(result).toBe(false);
    });

    it('возвращает false если validateJwt бросает ошибку', async () => {
      mockHashLoginString
        .mockResolvedValueOnce(FAKE_LOGIN_HASH)
        .mockResolvedValueOnce(FAKE_SECRET_HASH);

      mockValidateJwt.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = await service.checkToken('expired.token');
      expect(result).toBe(false);
    });

    it('возвращает false для пустой строки', async () => {
      mockHashLoginString
        .mockResolvedValueOnce(FAKE_LOGIN_HASH)
        .mockResolvedValueOnce(FAKE_SECRET_HASH);

      mockValidateJwt.mockReturnValue(false);

      const result = await service.checkToken('');
      expect(result).toBe(false);
    });
  });

  // ─── setTokenToCookie ─────────────────────────────────────────────────────

  describe('setTokenToCookie', () => {
    const mockRes = () => ({ cookie: jest.fn() }) as any;

    it('устанавливает куку с правильными параметрами', () => {
      const res = mockRes();
      service.setTokenToCookie(FAKE_TOKEN, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'bearer',
        FAKE_TOKEN,
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000,
        }),
      );
    });

    it('не вызывает res.cookie если токен пустой', () => {
      const res = mockRes();
      service.setTokenToCookie('', res);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('не вызывает res.cookie если токен undefined', () => {
      const res = mockRes();
      service.setTokenToCookie(undefined as any, res);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });
});
