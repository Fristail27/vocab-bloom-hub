import { BadRequestException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { createJwt, validateJwt } from '../../../core/utils/auth';
import { hashLoginString } from '../../../core/utils/crypto';
import { RoleE } from '../../../types';
import { ErrorCodes } from '../../../core/constants/error_codes';

@Injectable()
export class AuthService {
  constructor() {}

  private async getLoginHash(): Promise<{
    loginHash: string;
    secretHash: string;
  }> {
    const username = process.env.USERNAME as string;
    const pass = process.env.PASSWORD as string;
    const loginHash = await hashLoginString(username, pass);
    const secretHash = await hashLoginString(username, loginHash);

    return { loginHash, secretHash };
  }

  setTokenToCookie(token: string, res: Response) {
    if (token) {
      res.cookie('bearer', token, {
        httpOnly: false,
        secure: false, // true в production
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }
  }

  async createJwtToken(): Promise<string> {
    const username = process.env.USERNAME as string;
    const { loginHash, secretHash } = await this.getLoginHash();

    return createJwt({ username, roles: [RoleE.admin] }, secretHash + loginHash);
  }

  async login(hash: string): Promise<string> {
    const username = process.env.USERNAME as string;
    const { loginHash, secretHash } = await this.getLoginHash();
    if (loginHash !== hash) {
      throw new BadRequestException(ErrorCodes.login_or_pass_wrong);
    }

    return createJwt({ username, roles: [RoleE.admin] }, secretHash + loginHash);
  }

  async checkToken(jwt: string): Promise<boolean> {
    try {
      const username = process.env.USERNAME as string;
      const pass = process.env.PASSWORD as string;
      const hashByEnv = await hashLoginString(username, pass);
      const secretHash = await hashLoginString(username, hashByEnv);

      return validateJwt(jwt, secretHash + hashByEnv);
    } catch {
      return false;
    }
  }
}
