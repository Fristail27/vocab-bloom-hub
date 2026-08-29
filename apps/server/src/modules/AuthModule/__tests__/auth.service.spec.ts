import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import { hashLoginString } from '../../../../core/utils/crypto';
import { AuthService } from '../auth.service';

// Мокаем crypto и auth утилиты
jest.mock('../../../../core/utils/crypto');
jest.mock('../../../../core/utils/auth');

import { createJwt, validateJwt } from '../../../../core/utils/auth';

const mockHashLoginString = hashLoginString as jest.MockedFunction<typeof hashLoginString>;
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
    process.env.ADMIN_USERNAME = ENV_USERNAME;
    process.env.ADMIN_PASSWORD = ENV_PASSWORD;
  });

  beforeEach(() => {
    service = new AuthService();

    // hashLoginString вызывается дважды в getLoginHash:
    // 1й вызов: hash(username, pass)      → loginHash
    // 2й вызов: hash(username, loginHash) → secretHash
    mockHashLoginString.mockResolvedValueOnce(FAKE_LOGIN_HASH).mockResolvedValueOnce(FAKE_SECRET_HASH);

    mockCreateJwt.mockReturnValue(FAKE_TOKEN);
    mockValidateJwt.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // The time-slot proof login logic is covered in auth.service.login-proof.spec.ts
  // with real crypto instead of mocks

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
      mockHashLoginString.mockResolvedValueOnce(FAKE_LOGIN_HASH).mockResolvedValueOnce(FAKE_SECRET_HASH);

      mockValidateJwt.mockReturnValue(true);

      const result = await service.checkToken(FAKE_TOKEN);
      expect(result).toBe(true);
    });

    it('возвращает false для невалидного токена', async () => {
      mockHashLoginString.mockResolvedValueOnce(FAKE_LOGIN_HASH).mockResolvedValueOnce(FAKE_SECRET_HASH);

      mockValidateJwt.mockReturnValue(false);

      const result = await service.checkToken('bad.token');
      expect(result).toBe(false);
    });

    it('возвращает false если validateJwt бросает ошибку', async () => {
      mockHashLoginString.mockResolvedValueOnce(FAKE_LOGIN_HASH).mockResolvedValueOnce(FAKE_SECRET_HASH);

      mockValidateJwt.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = await service.checkToken('expired.token');
      expect(result).toBe(false);
    });

    it('возвращает false для пустой строки', async () => {
      mockHashLoginString.mockResolvedValueOnce(FAKE_LOGIN_HASH).mockResolvedValueOnce(FAKE_SECRET_HASH);

      mockValidateJwt.mockReturnValue(false);

      const result = await service.checkToken('');
      expect(result).toBe(false);
    });
  });

  // ─── setTokenToCookie ─────────────────────────────────────────────────────

  describe('setTokenToCookie', () => {
    const mockRes = () => ({ cookie: jest.fn() }) as any;
    const mockReq = (secure: boolean) => ({ secure }) as any;

    it('устанавливает secure-куку, когда запрос пришёл по https', () => {
      const res = mockRes();
      service.setTokenToCookie(FAKE_TOKEN, res, mockReq(true));

      expect(res.cookie).toHaveBeenCalledWith(
        'bearer',
        FAKE_TOKEN,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000,
        }),
      );
    });

    it('ставит обычную куку по http и предупреждает об этом в production (issue #316)', () => {
      const saved = process.env.NODE_ENV;
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        process.env.NODE_ENV = 'development';
        const res = mockRes();
        service.setTokenToCookie(FAKE_TOKEN, res, mockReq(false));
        expect(res.cookie).toHaveBeenCalledWith(
          'bearer',
          FAKE_TOKEN,
          expect.objectContaining({ secure: false }),
        );
        expect(warn).not.toHaveBeenCalled();

        process.env.NODE_ENV = 'production';
        service.setTokenToCookie(FAKE_TOKEN, mockRes(), mockReq(false));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('without the secure flag'));
      } finally {
        process.env.NODE_ENV = saved;
        warn.mockRestore();
      }
    });

    it('не вызывает res.cookie если токен пустой', () => {
      const res = mockRes();
      service.setTokenToCookie('', res, mockReq(true));
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('не вызывает res.cookie если токен undefined', () => {
      const res = mockRes();
      service.setTokenToCookie(undefined as any, res, mockReq(true));
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });
});
