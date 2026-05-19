import cookies from 'js-cookie';

export class AbstractBaseApi {
    static isInitialized: boolean = false;
    static get baseURL(): string {
        return process.env.NEXT_PUBLIC_BASE_API_URL || '/api'
    }

    static async getToken(): Promise<string | undefined> {
        return cookies.get('bearer') as string;
    }
}