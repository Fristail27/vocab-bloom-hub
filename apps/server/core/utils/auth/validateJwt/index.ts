import * as jwt from 'jsonwebtoken';
import type {JwtPayload} from "jsonwebtoken";

export function validateJwt(token: string, secret: string): boolean {
    try {
        const decoded = jwt.verify(token, secret) as JwtPayload;
        return !!decoded
    } catch (error) {
        return false;
    }
}