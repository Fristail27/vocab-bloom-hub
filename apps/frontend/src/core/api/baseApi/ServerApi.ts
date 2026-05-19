import {cookies} from "next/headers";

export class BaseServerApi {
    static get baseURL(): string {
        return process.env.BASE_API_URL as string
    }

    async getBearer (): Promise<string | undefined> {
        const cookieStore = await cookies();
        return cookieStore.get('bearer')?.value;
    }
}