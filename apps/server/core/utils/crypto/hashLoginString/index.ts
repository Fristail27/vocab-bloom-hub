/**
 * The credentials hash every piece of the auth flow builds on: the login
 * proof's HMAC key in the browser, the proof verification and the JWT
 * signing key on the server.
 *
 * PBKDF2-SHA256 instead of the former raw SHA-256 composition (issue #344):
 * a leaked admin JWT is an offline oracle for the password, and the point of
 * a deliberately slow derivation is to price a guess at a fraction of a
 * second instead of nanoseconds. WebCrypto's PBKDF2 is the strongest KDF the
 * browser and Node share — the admin UI computes the same derivation
 * client-side and the password never crosses the wire. The salt is
 * deterministic by design: both sides must derive the same value without
 * exchanging anything.
 */
const PBKDF2_ITERATIONS = 600_000;

const derive = async (username: string, pass: string): Promise<string> => {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', encoder.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(`vocab-bloom-hub-login:${username}`),
      iterations: PBKDF2_ITERATIONS,
    },
    material,
    256,
  );

  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// The derivation is a pure function of values that never change within a
// run, and the server needs it on every login slot check and check-token —
// memoized so the slow path runs once per credential pair (the cap only
// matters for test suites that flip the env between modules)
const cache = new Map<string, Promise<string>>();

export const hashLoginString = (username: string, pass: string): Promise<string> => {
  // NUL cannot appear in an env value, so the pair is unambiguous
  const key = `${username}\u0000${pass}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pending = derive(username, pass);
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  if (cache.size > 16) cache.delete(cache.keys().next().value as string);

  return pending;
};
