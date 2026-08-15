import { hashLoginString } from '../hashLoginString';
import { hmacSha256 } from '../hmacSha256';

// The login proof is an HMAC over a time slot and a random salt, keyed by the
// credentials hash. The credentials hash itself never crosses the wire, and an
// intercepted proof dies with its time slot, so it cannot be replayed later.
export const LOGIN_PROOF_WINDOW_MS = 60_000;
// How many neighboring slots the server accepts (clock skew + request latency)
export const LOGIN_PROOF_SLOT_TOLERANCE = 1;

export const getLoginProofTimeSlot = (timestamp: number = Date.now()): number =>
  Math.floor(timestamp / LOGIN_PROOF_WINDOW_MS);

export const hashLoginProof = async (
  username: string,
  pass: string,
  timeSlot: number,
  salt: string,
): Promise<string> => {
  const loginHash = await hashLoginString(username, pass);
  return hmacSha256(loginHash, `${timeSlot}:${salt}`);
};

// The salt makes every proof unique, so a repeated login inside one time slot
// still produces a fresh value and the server can reject exact replays
export const createLoginProof = async (
  username: string,
  pass: string,
): Promise<{ hash: string; salt: string }> => {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hash = await hashLoginProof(username, pass, getLoginProofTimeSlot(), salt);
  return { hash, salt };
};
