import { timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { createJwt, validateJwt } from '../../../core/utils/auth';
import {
  LOGIN_PROOF_SLOT_TOLERANCE,
  LOGIN_PROOF_WINDOW_MS,
  getLoginProofTimeSlot,
  hashLoginProof,
  hashLoginString,
} from '../../../core/utils/crypto';
import { RoleE } from '../../../types';
import { ErrorCodes } from '../../../core/constants/error_codes';

const timingSafeStringEqual = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Accepted proofs are remembered until their time slot can no longer match,
  // which makes every proof single-use and defeats replay of captured requests
  private readonly usedProofs = new Map<string, number>();

  constructor() {}

  private async getLoginHash(): Promise<{
    loginHash: string;
    secretHash: string;
  }> {
    const username = process.env.ADMIN_USERNAME as string;
    const pass = process.env.ADMIN_PASSWORD as string;
    const loginHash = await hashLoginString(username, pass);
    const secretHash = await hashLoginString(username, loginHash);

    return { loginHash, secretHash };
  }

  setTokenToCookie(token: string, res: Response) {
    if (token) {
      res.cookie('bearer', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }
  }

  async createJwtToken(): Promise<string> {
    const username = process.env.ADMIN_USERNAME as string;
    const { loginHash, secretHash } = await this.getLoginHash();

    return createJwt({ username, roles: [RoleE.admin] }, secretHash + loginHash);
  }

  private pruneUsedProofs(now: number) {
    for (const [proof, expiresAt] of this.usedProofs) {
      if (expiresAt <= now) {
        this.usedProofs.delete(proof);
      }
    }
  }

  async login(hash: string, salt: string): Promise<string> {
    const username = process.env.ADMIN_USERNAME as string;
    const pass = process.env.ADMIN_PASSWORD as string;
    const now = Date.now();
    const currentSlot = getLoginProofTimeSlot(now);

    // No early exit: every candidate slot is checked with a constant-time
    // comparison so response duration does not depend on the submitted value
    let matches = false;
    for (let offset = -LOGIN_PROOF_SLOT_TOLERANCE; offset <= LOGIN_PROOF_SLOT_TOLERANCE; offset++) {
      const expected = await hashLoginProof(username, pass, currentSlot + offset, salt);
      matches = timingSafeStringEqual(expected, hash) || matches;
    }

    this.pruneUsedProofs(now);
    if (!matches || this.usedProofs.has(hash)) {
      this.logger.warn(`Failed login attempt for user "${username}"`);
      throw new BadRequestException(ErrorCodes.login_or_pass_wrong);
    }
    this.usedProofs.set(hash, now + (LOGIN_PROOF_SLOT_TOLERANCE + 1) * LOGIN_PROOF_WINDOW_MS);

    this.logger.log(`User "${username}" logged in`);

    const { loginHash, secretHash } = await this.getLoginHash();
    return createJwt({ username, roles: [RoleE.admin] }, secretHash + loginHash);
  }

  async checkToken(jwt: string): Promise<boolean> {
    try {
      const username = process.env.ADMIN_USERNAME as string;
      const pass = process.env.ADMIN_PASSWORD as string;
      const hashByEnv = await hashLoginString(username, pass);
      const secretHash = await hashLoginString(username, hashByEnv);

      return validateJwt(jwt, secretHash + hashByEnv);
    } catch {
      return false;
    }
  }
}
