import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

import { getCorsOrigins, isSwaggerEnabled, shouldCompress } from '../http-hardening';

describe('HTTP hardening utils (issue #183)', () => {
  describe('getCorsOrigins', () => {
    it('falls back to the local frontend origin', () => {
      expect(getCorsOrigins({})).toEqual(['http://localhost:3000']);
    });

    it('respects FRONT_PORT in the fallback', () => {
      expect(getCorsOrigins({ FRONT_PORT: '4000' })).toEqual(['http://localhost:4000']);
    });

    it('parses a comma-separated CORS_ORIGINS list, trimming spaces and empty entries', () => {
      const env = { CORS_ORIGINS: ' https://admin.example.com , https://staging.example.com ,, ' };
      expect(getCorsOrigins(env)).toEqual(['https://admin.example.com', 'https://staging.example.com']);
    });

    it('ignores a blank CORS_ORIGINS value', () => {
      expect(getCorsOrigins({ CORS_ORIGINS: '   ' })).toEqual(['http://localhost:3000']);
    });
  });

  describe('shouldCompress', () => {
    const makeReq = (): Request => ({ headers: {}, method: 'GET' }) as unknown as Request;
    const makeRes = (headers: Record<string, string>): Response =>
      ({
        getHeader: jest.fn((name: string) => headers[name]),
      }) as unknown as Response;

    it('never compresses streaming responses marked with X-Accel-Buffering: no', () => {
      const res = makeRes({
        'X-Accel-Buffering': 'no',
        'Content-Type': 'text/plain; charset=utf-8',
      });
      expect(shouldCompress(makeReq(), res)).toBe(false);
    });

    it('compresses regular compressible responses', () => {
      const res = makeRes({ 'Content-Type': 'application/json' });
      expect(shouldCompress(makeReq(), res)).toBe(true);
    });
  });

  describe('isSwaggerEnabled', () => {
    it('serves Swagger outside production', () => {
      expect(isSwaggerEnabled({})).toBe(true);
      expect(isSwaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
    });

    it('disables Swagger in production', () => {
      expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
    });
  });
});
