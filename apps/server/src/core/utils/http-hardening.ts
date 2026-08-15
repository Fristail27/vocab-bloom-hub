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
