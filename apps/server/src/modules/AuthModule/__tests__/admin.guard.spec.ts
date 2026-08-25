import { beforeAll, describe, expect, it } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AdminGuard } from '../guards/admin.guard';
import { createJwt } from '../../../../core/utils/auth';
import { hashLoginString } from '../../../../core/utils/crypto';

const makeContext = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('AdminGuard (issue #165)', () => {
  const ENV_USERNAME = 'admin';
  const ENV_PASSWORD = 'secret';
  let guard: AdminGuard;
  let validToken: string;

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = ENV_USERNAME;
    process.env.ADMIN_PASSWORD = ENV_PASSWORD;
    guard = new AdminGuard();

    // same derivation as AuthService.login
    const loginHash = await hashLoginString(ENV_USERNAME, ENV_PASSWORD);
    const secretHash = await hashLoginString(ENV_USERNAME, loginHash);
    validToken = createJwt({ username: ENV_USERNAME, roles: ['admin'] }, secretHash + loginHash);
  });

  it('кидает 401 (не 500) без Authorization и куки', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('кидает 401 для битого токена', async () => {
    await expect(guard.canActivate(makeContext({ authorization: 'Bearer garbage' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('кидает 401 для заголовка не по схеме Bearer', async () => {
    await expect(guard.canActivate(makeContext({ authorization: 'Basic abc123' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('пропускает валидный токен из заголовка', async () => {
    await expect(guard.canActivate(makeContext({ authorization: `Bearer ${validToken}` }))).resolves.toBe(true);
  });

  it('пропускает валидный токен из куки bearer', async () => {
    await expect(guard.canActivate(makeContext({ cookie: `bearer=${validToken}` }))).resolves.toBe(true);
  });
});
