import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { AuthController } from '../auth.controller';
import { LoginReqDTO } from '../dto/LoginReq.dto';

// Same options as the global pipe in main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validateBody = (value: unknown) => pipe.transform(value, { type: 'body', metatype: LoginReqDTO });

const VALID_HASH = 'a'.repeat(64);
const VALID_SALT = 'aabbccddeeff00112233445566778899';

describe('LoginReqDTO validation (issue #184)', () => {
  it('login body param is typed with LoginReqDTO, not Object', () => {
    const paramTypes: unknown[] = Reflect.getMetadata('design:paramtypes', AuthController.prototype, 'login');
    expect(paramTypes[0]).toBe(LoginReqDTO);
  });

  it('accepts a valid proof body', async () => {
    await expect(validateBody({ hash: VALID_HASH, salt: VALID_SALT })).resolves.toBeInstanceOf(LoginReqDTO);
  });

  it('rejects a missing salt', async () => {
    await expect(validateBody({ hash: VALID_HASH })).rejects.toThrow(BadRequestException);
  });

  it('rejects a hash that is not a 64-char hex digest', async () => {
    await expect(validateBody({ hash: 'not-hex', salt: VALID_SALT })).rejects.toThrow(BadRequestException);
    await expect(validateBody({ hash: VALID_HASH.slice(1), salt: VALID_SALT })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects unknown fields', async () => {
    await expect(validateBody({ hash: VALID_HASH, salt: VALID_SALT, extra: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
