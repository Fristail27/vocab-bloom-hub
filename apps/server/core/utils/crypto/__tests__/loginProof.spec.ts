import { createHmac } from 'crypto';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  LOGIN_PROOF_WINDOW_MS,
  createLoginProof,
  getLoginProofTimeSlot,
  hashLoginProof,
  hashLoginString,
  hmacSha256,
} from '..';

describe('login proof crypto utils (issue #184)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('hmacSha256', () => {
    it('matches node crypto HMAC-SHA256', async () => {
      const expected = createHmac('sha256', 'the-key').update('the-message').digest('hex');
      await expect(hmacSha256('the-key', 'the-message')).resolves.toBe(expected);
    });
  });

  describe('getLoginProofTimeSlot', () => {
    it('splits time into fixed windows', () => {
      expect(getLoginProofTimeSlot(0)).toBe(0);
      expect(getLoginProofTimeSlot(LOGIN_PROOF_WINDOW_MS - 1)).toBe(0);
      expect(getLoginProofTimeSlot(LOGIN_PROOF_WINDOW_MS)).toBe(1);
      expect(getLoginProofTimeSlot(5 * LOGIN_PROOF_WINDOW_MS + 1)).toBe(5);
    });
  });

  describe('hashLoginProof', () => {
    it('is deterministic for the same inputs', async () => {
      const a = await hashLoginProof('admin', 'secret', 100, 'aabbcc');
      const b = await hashLoginProof('admin', 'secret', 100, 'aabbcc');
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('changes with the time slot and with the salt', async () => {
      const base = await hashLoginProof('admin', 'secret', 100, 'aabbcc');
      await expect(hashLoginProof('admin', 'secret', 101, 'aabbcc')).resolves.not.toBe(base);
      await expect(hashLoginProof('admin', 'secret', 100, 'ddeeff')).resolves.not.toBe(base);
    });

    it('never equals the raw credentials hash (password equivalent stays off the wire)', async () => {
      const loginHash = await hashLoginString('admin', 'secret');
      await expect(hashLoginProof('admin', 'secret', 100, 'aabbcc')).resolves.not.toBe(loginHash);
    });
  });

  describe('createLoginProof', () => {
    it('produces a random hex salt and a proof for the current time slot', async () => {
      const now = 42 * LOGIN_PROOF_WINDOW_MS + 5;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const { hash, salt } = await createLoginProof('admin', 'secret');

      expect(salt).toMatch(/^[0-9a-f]{32}$/);
      await expect(hashLoginProof('admin', 'secret', 42, salt)).resolves.toBe(hash);
    });

    it('produces a different proof on every call', async () => {
      const first = await createLoginProof('admin', 'secret');
      const second = await createLoginProof('admin', 'secret');
      expect(second.salt).not.toBe(first.salt);
      expect(second.hash).not.toBe(first.hash);
    });
  });
});
