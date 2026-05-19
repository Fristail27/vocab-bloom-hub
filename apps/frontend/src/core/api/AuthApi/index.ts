import {BaseApi} from "../baseApi";

export class AuthApi extends BaseApi {
    static async login (params: URLSearchParams) {
        const url = `${this.baseURL}/auth/login?${params.toString()}`;
        const res = await fetch(url)
        return await res.json()
    }

    static async checkToken (token: string) {
        const url = `${this.baseURL}/auth/check-token?token=${token}`;
        const res = await fetch(url)
        return await res.text()
    }
}