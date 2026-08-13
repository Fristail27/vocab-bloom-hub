import type { Request } from 'express';

export const getBearerFromRequest = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token && token !== 'undefined' && token !== 'null') {
      return token;
    }
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'bearer' && rest.length > 0) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
};
