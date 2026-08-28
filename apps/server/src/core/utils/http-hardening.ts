import type { Request, Response } from 'express';
import compression from 'compression';

// Comma-separated CORS_ORIGINS; falls back to the local frontend origin
export const getCorsOrigins = (env: NodeJS.ProcessEnv = process.env): string[] => {
  const raw = env.CORS_ORIGINS;
  if (raw?.trim()) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  return [`http://localhost:${env.FRONT_PORT || 3000}`];
};

// Progress endpoints stream newline-delimited chunks and mark themselves with
// X-Accel-Buffering: no; compressing them would buffer the stream and stall
// the client's progress updates
export const shouldCompress = (req: Request, res: Response): boolean => {
  if (res.getHeader('X-Accel-Buffering') === 'no') {
    return false;
  }
  return compression.filter(req, res);
};

// The Swagger UI publicly documents the whole admin API surface, so it is
// served only outside production
export const isSwaggerEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.NODE_ENV !== 'production';

export type TrustProxyT = boolean | number | string;

// TRUST_PROXY is handed to Express's `trust proxy` setting (issue #283). Behind
// a reverse proxy the client address the rate limits and the logs see comes
// from X-Forwarded-For, which Express only reads from trusted hops: a hop
// count (`1` — the usual single proxy), `loopback` / `linklocal` /
// `uniquelocal`, an IP or CIDR list, or `true` for every hop (unsafe unless
// the proxy rewrites the header: a client could forge its address and dodge
// the limits). Unset, blank, `false` or `0` keep the header ignored.
export const parseTrustProxy = (raw: string | undefined): TrustProxyT => {
  const value = raw?.trim();
  if (!value || value === 'false' || value === '0') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
};

export const getTrustProxy = (env: NodeJS.ProcessEnv = process.env): TrustProxyT =>
  parseTrustProxy(env.TRUST_PROXY);
