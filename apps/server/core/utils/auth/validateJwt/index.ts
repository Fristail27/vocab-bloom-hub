import type { JwtPayload } from 'jsonwebtoken';
import * as jwt from 'jsonwebtoken';

export function validateJwt(token: string, secret: string): boolean {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return !!decoded;
  } catch {
    return false;
  }
}
