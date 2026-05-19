import cookies from 'js-cookie';

export class BaseApi {
    static isInitialized: boolean = false;
    static get baseURL(): string {
        return process.env.BASE_API_URL || 'http://localhost:3010/api'
    }

    static async getBearer (): Promise<string | undefined> {
        return cookies.get('bearer') as string;
    }
}