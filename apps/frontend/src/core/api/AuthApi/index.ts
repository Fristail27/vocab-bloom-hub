import { CheckTokenResBody, LoginReqBody, LoginResBody } from 'server/types';
import { AbstractBaseApi } from '../AbstractBaseApi';

export class AuthApi extends AbstractBaseApi {
  static async login(hash: LoginReqBody): Promise<LoginResBody> {
    return this.post(`${this.baseURL}/auth/login`, hash, { credentials: 'include' });
  }

  static async checkToken(): Promise<CheckTokenResBody> {
    const res = await this.get<CheckTokenResBody>(`${this.baseURL}/auth/check-token`);
    if ('error' in res) {
      return { isValid: false };
    }
    return res;
  }
}
