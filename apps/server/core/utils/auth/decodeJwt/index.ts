import type { JwtPayload } from 'jsonwebtoken';
import * as jwt from 'jsonwebtoken';

export function decodeJwt(token: string, secret: string): JwtPayload | null {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}
