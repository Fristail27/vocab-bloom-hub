import {sha256} from "../sha256";

export const hashLoginString = async (username: string, pass: string): Promise<string> => {
    const usernameHash = await sha256(username);
    const passHash = await sha256(pass);
    const summaryHash = await sha256(username+pass);

    return await sha256(usernameHash+passHash+summaryHash);
}