import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';

import {
  LOGIN_PROOF_WINDOW_MS,
  createLoginProof,
  getLoginProofTimeSlot,
  hashLoginProof,
} from '../../../../core/utils/crypto';
import { AuthService } from '../auth.service';

// Real crypto and JWT: this spec verifies the actual time-slot + replay logic
describe('AuthService.login proof exchange (issue #184)', () => {
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'secret';
  const NOW = 1_000_000 * LOGIN_PROOF_WINDOW_MS + 10_000;
  const SALT = 'aabbccddeeff00112233445566778899';

  let service: AuthService;
  let prevUsername: string | undefined;
  let prevPassword: string | undefined;

  beforeAll(() => {
    prevUsername = process.env.ADMIN_USERNAME;
    prevPassword = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_USERNAME = ADMIN_USERNAME;
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  afterAll(() => {
    process.env.ADMIN_USERNAME = prevUsername;
    process.env.ADMIN_PASSWORD = prevPassword;
  });

  beforeEach(() => {
    service = new AuthService();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const proofForSlot = (slot: number, salt: string = SALT) =>
    hashLoginProof(ADMIN_USERNAME, ADMIN_PASSWORD, slot, salt);

  const currentSlot = () => getLoginProofTimeSlot(NOW);

  it('issues a JWT for a proof of the current time slot', async () => {
    const token = await service.login(await proofForSlot(currentSlot()), SALT);

    expect(typeof token).toBe('string');
    await expect(service.checkToken(token)).resolves.toBe(true);
  });

  it('accepts proofs from the neighboring slots (clock skew tolerance)', async () => {
    await expect(service.login(await proofForSlot(currentSlot() - 1), SALT)).resolves.toEqual(
      expect.any(String),
    );
    await expect(
      service.login(await proofForSlot(currentSlot() + 1, 'ff00ff00ff00ff00'), 'ff00ff00ff00ff00'),
    ).resolves.toEqual(expect.any(String));
  });

  it('rejects a proof from an expired time slot', async () => {
    await expect(service.login(await proofForSlot(currentSlot() - 2), SALT)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a proof built from wrong credentials', async () => {
    const wrong = await hashLoginProof(ADMIN_USERNAME, 'wrong-password', currentSlot(), SALT);
    await expect(service.login(wrong, SALT)).rejects.toThrow('login_or_pass_wrong');
  });

  it('rejects a replay of an already used proof', async () => {
    const proof = await proofForSlot(currentSlot());

    await expect(service.login(proof, SALT)).resolves.toEqual(expect.any(String));
    await expect(service.login(proof, SALT)).rejects.toThrow(BadRequestException);
  });

  it('still rejects a captured proof after its slot expires and the replay cache is pruned', async () => {
    const proof = await proofForSlot(currentSlot());
    await service.login(proof, SALT);

    jest.spyOn(Date, 'now').mockReturnValue(NOW + 3 * LOGIN_PROOF_WINDOW_MS);

    await expect(service.login(proof, SALT)).rejects.toThrow(BadRequestException);
  });

  it('allows an immediate re-login within the same slot thanks to a fresh salt', async () => {
    await expect(service.login(await proofForSlot(currentSlot()), SALT)).resolves.toEqual(expect.any(String));

    const fresh = await createLoginProof(ADMIN_USERNAME, ADMIN_PASSWORD);
    await expect(service.login(fresh.hash, fresh.salt)).resolves.toEqual(expect.any(String));
  });

  it('binds the proof to its salt: a valid hash with a different salt is rejected', async () => {
    const proof = await proofForSlot(currentSlot());
    await expect(service.login(proof, 'ff00ff00ff00ff00')).rejects.toThrow(BadRequestException);
  });
});
