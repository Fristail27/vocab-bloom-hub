import { CheckTokenResBody, ErrorResT, LoginReqBody, LoginResBody, LogoutResBody } from 'server/types';
import { AbstractBaseApi } from '../AbstractBaseApi';

export class AuthApi extends AbstractBaseApi {
  static async login(body: LoginReqBody): Promise<LoginResBody> {
    return this.post(`${this.baseURL}/auth/login`, body, { credentials: 'include' });
  }

  static async logout(): Promise<LogoutResBody | ErrorResT> {
    return this.post(`${this.baseURL}/auth/logout`, {}, { credentials: 'include' });
  }

  static async checkToken(): Promise<CheckTokenResBody> {
    const res = await this.get<CheckTokenResBody>(`${this.baseURL}/auth/check-token`);
    if ('error' in res) {
      return { isValid: false };
    }
    return res;
  }
}
