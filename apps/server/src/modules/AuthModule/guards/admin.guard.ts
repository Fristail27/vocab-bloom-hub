import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { validateJwt } from '../../../../core/utils/auth';
import { hashLoginString } from '../../../../core/utils/crypto';
import { ErrorCodes } from '../../../../core/constants/error_codes';
import { getBearerFromRequest } from '../../../core/utils/get-bearer-from-request';

// The verification key is a pure function of the credentials, which never
// change within a run — deriving it hashed on every request (issue #355).
// Keyed by the env values: the test suites flip them between modules.
let cachedSecret: { key: string; secret: string } | null = null;

const deriveSecret = async (username: string, pass: string): Promise<string> => {
  // NUL cannot appear in an env value, so the pair is unambiguous
  const key = `${username}\u0000${pass}`;
  if (cachedSecret?.key !== key) {
    const hashByEnv = await hashLoginString(username, pass);
    const secretHash = await hashLoginString(username, hashByEnv);
    cachedSecret = { key, secret: secretHash + hashByEnv };
  }

  return cachedSecret.secret;
};

/** Whether a request carries the admin's token; what the guard checks, for a middleware that runs before it */
export const isAdminRequest = async (request: Request): Promise<boolean> => {
  const token = getBearerFromRequest(request);
  if (!token) return false;
  const username = process.env.ADMIN_USERNAME as string;
  const pass = process.env.ADMIN_PASSWORD as string;
  return validateJwt(token, await deriveSecret(username, pass));
};

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await isAdminRequest(context.switchToHttp().getRequest<Request>()))) {
      throw new UnauthorizedException(ErrorCodes.invalid_token);
    }
    return true;
  }
}
