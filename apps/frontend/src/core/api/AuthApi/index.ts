import { LoginReqBody, LoginResBody } from '../../../../../server/types';
import { AbstractBaseApi } from '../AbstractBaseApi';

export class AuthApi extends AbstractBaseApi {
  static async login(hash: LoginReqBody): Promise<LoginResBody> {
    const url = `${this.baseURL}/auth/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(hash),
    });
    return await res.json();
  }

  static async checkToken() {
    const url = `${this.baseURL}/auth/check-token`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.getToken()}`,
      },
    });
    return await res.json();
  }
}
