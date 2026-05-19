import jwt, {JwtPayload} from 'jsonwebtoken';

export function createJwt(payload: JwtPayload, secret: string): string {
    return jwt.sign(payload, secret, {expiresIn: '1d'});
}