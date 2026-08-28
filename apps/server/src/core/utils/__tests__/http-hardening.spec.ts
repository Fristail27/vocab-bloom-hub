import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';

import {
  getCorsOrigins,
  getTrustProxy,
  isSwaggerEnabled,
  parseTrustProxy,
  shouldCompress,
} from '../http-hardening';

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

  describe('parseTrustProxy (issue #283)', () => {
    it('ignores X-Forwarded-* when unset, blank or switched off', () => {
      expect(parseTrustProxy(undefined)).toBe(false);
      expect(parseTrustProxy('  ')).toBe(false);
      expect(parseTrustProxy('false')).toBe(false);
      expect(parseTrustProxy('0')).toBe(false);
    });

    it('turns a hop count into a number and true into every hop', () => {
      expect(parseTrustProxy('1')).toBe(1);
      expect(parseTrustProxy(' 2 ')).toBe(2);
      expect(parseTrustProxy('true')).toBe(true);
    });

    it('passes address lists and the Express keywords through unchanged', () => {
      expect(parseTrustProxy('loopback')).toBe('loopback');
      expect(parseTrustProxy('10.0.0.0/8, 172.16.0.0/12')).toBe('10.0.0.0/8, 172.16.0.0/12');
    });

    it('reads TRUST_PROXY from the environment', () => {
      expect(getTrustProxy({})).toBe(false);
      expect(getTrustProxy({ TRUST_PROXY: '1' })).toBe(1);
    });
  });
});
