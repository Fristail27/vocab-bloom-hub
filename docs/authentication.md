# Authentication flow

This document describes the full authentication flow of Vocab Bloom Hub as implemented today.

## Overview

The platform has a **single admin user** and no user table. Credentials live in the environment
(`ADMIN_USERNAME` / `ADMIN_PASSWORD` in the root `.env`), and everything else — the login proof, the JWT signing
secret, the guard checks — is derived from them at runtime.

Key properties of the design:

- The password (or any static equivalent of it) **never crosses the wire**. The client sends a
  one-time, time-bound proof instead.
- Login proofs are **single-use** and expire with their time window, so captured requests cannot be
  replayed (issue #184).
- All secret comparisons on the server are **constant-time** (`crypto.timingSafeEqual`).
- The session is a **JWT in an httpOnly cookie**; the browser never exposes it to JS.

## Building blocks

| Piece                                                                | Location                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Credentials hash (`hashLoginString`)                                 | `apps/server/core/utils/crypto/hashLoginString`            |
| HMAC helper (`hmacSha256`)                                           | `apps/server/core/utils/crypto/hmacSha256`                 |
| Login proof utils (`createLoginProof`, `hashLoginProof`, time slots) | `apps/server/core/utils/crypto/loginProof`                 |
| JWT create/validate (`jsonwebtoken`)                                 | `apps/server/core/utils/auth`                              |
| Auth endpoints                                                       | `apps/server/src/modules/AuthModule/auth.controller.ts`    |
| Login/replay logic                                                   | `apps/server/src/modules/AuthModule/auth.service.ts`       |
| Route protection (`AdminGuard`)                                      | `apps/server/src/modules/AuthModule/guards/admin.guard.ts` |
| Token extraction (header or cookie)                                  | `apps/server/src/core/utils/get-bearer-from-request.ts`    |
| Browser API client                                                   | `apps/frontend/src/core/api/AuthApi`                       |
| SSR API client (forwards the cookie)                                 | `apps/frontend/src/core/api/AbstractBaseApi/ServerApi.ts`  |

All crypto helpers are built on `crypto.subtle`, so the **same code** runs in the browser and in
Node — the frontend and the server can never disagree on how a proof is computed.

### The credentials hash

```
loginHash  = sha256(sha256(username) + sha256(password) + sha256(username + password))
secretHash = sha256(sha256(username) + sha256(loginHash) + sha256(username + loginHash))
```

`loginHash` is the client-side secret used to key login proofs. `secretHash + loginHash` is the JWT
signing secret. Both are derived on demand from the env credentials and are never stored or sent.

## Login: the proof exchange

`POST /api/auth/login` accepts a body validated by `LoginReqDTO`:

```jsonc
{
  "hash": "<64 hex chars>", // HMAC-SHA256 proof
  "salt": "<16-64 hex chars>", // fresh client randomness
}
```

### How the client builds it (`createLoginProof`)

1. Compute `loginHash` from the values typed into the login form.
2. Compute the current **time slot**: `timeSlot = floor(Date.now() / 60_000)` — a counter that
   increments every 60 seconds (`LOGIN_PROOF_WINDOW_MS`) and is computed independently by both
   sides; it is never transmitted.
3. Generate a **salt**: 16 random bytes from `crypto.getRandomValues`, hex-encoded. The salt is not
   a secret — its job is to make every proof unique.
4. Compute the proof: `hash = HMAC-SHA256(key: loginHash, message: "<timeSlot>:<salt>")`.
5. Send `{ hash, salt }`.

### How the server verifies it (`AuthService.login`)

1. Rebuild `loginHash` from the env credentials.
2. Recompute the expected proof for the time slots `now - 1`, `now`, `now + 1`
   (`LOGIN_PROOF_SLOT_TOLERANCE = 1`, tolerating clock skew and request latency) using the salt from
   the request.
3. Compare each candidate with `crypto.timingSafeEqual`. All candidate slots are always checked —
   there is no early exit, so the response time does not depend on the submitted value.
4. Reject the proof if it has already been used. Accepted proofs are remembered in an in-memory map
   until their slot can no longer match (2 × window), which makes every proof **single-use**.
5. On success, sign a JWT and return it (see below). On any failure the response is the same
   `400 login_or_pass_wrong`, so the reason (wrong password / stale slot / replay) is not leaked.

The endpoint is rate-limited to **5 requests per minute** (`@nestjs/throttler`).

### Why this defeats replay and timing attacks

- A captured `{ hash, salt }` pair is rejected immediately (single-use cache) and becomes
  permanently invalid once its time slot expires (~1–2 minutes).
- The salt is bound into the HMAC: an attacker cannot swap in a fresh salt without knowing
  `loginHash`, and `loginHash` never leaves the client.
- A legitimate second login inside the same minute still works, because a fresh salt produces a
  fresh proof.
- `timingSafeEqual` removes the timing side channel of a plain string comparison.

Known limitation: if the client clock drifts by more than ~1 window (60 s) from the server clock,
login fails with correct credentials. Widen `LOGIN_PROOF_SLOT_TOLERANCE` if that ever becomes a
problem. The used-proof cache is in-memory and therefore per-instance; the app currently runs as a
single instance.

## The session: JWT in an httpOnly cookie

On successful login the server:

1. Signs a JWT with payload `{ username, roles: ['admin'] }`, secret `secretHash + loginHash`, and
   `expiresIn: '1d'`.
2. Sets it as the `bearer` cookie: `httpOnly`, `sameSite: 'lax'`, `maxAge: 24h`, and `secure`
   whenever the login request itself came over https — directly, or through a reverse proxy
   whose `X-Forwarded-Proto` the server trusts (`TRUST_PROXY`,
   [deployment/reverse-proxy.md](./deployment/reverse-proxy.md)). A login over plain http gets a
   cookie without the flag, so an instance reached over http (`docker compose` on a
   workstation, a LAN without certificates) can sign in; in production that case is logged as a
   warning at every login, because the token travels unencrypted (issue #316).
3. Also returns `{ token }` in the response body.

## Authenticated requests

Protected routes are guarded by `AdminGuard`. The token is looked up by `getBearerFromRequest` in
this order:

1. `Authorization: Bearer <token>` header;
2. the `bearer` cookie.

The guard re-derives the signing secret from the env credentials and verifies the JWT (signature +
expiry). Invalid or missing tokens get `401 invalid_token`.

Client-side transport:

- **Browser** requests send the cookie automatically (`credentials: 'include'`).
- **SSR** (`Server*Api` wrappers) reads the incoming request's `bearer` cookie via `next/headers`
  and forwards it as an `Authorization: Bearer` header to the API.

## Session check and refresh

`GET /api/auth/check-token` (called by the root layout during SSR via `ServerAuthApi.checkToken`):

- no token → `{ isValid: false }`;
- invalid token → `{ isValid: false }`;
- valid token → `{ isValid: true }` **and** a freshly signed JWT is set into the cookie, sliding the
  session forward by another 24 h.

The layout passes `isAuth` into the client-side state; unauthenticated visitors are shown the login
page.

## Sequence diagram

```mermaid
sequenceDiagram
    participant B as Browser (LoginForm)
    participant S as Server (AuthModule)

    Note over B: user submits username + password
    B->>B: loginHash = hashLoginString(u, p)
    B->>B: salt = random 16 bytes
    B->>B: hash = HMAC(loginHash, timeSlot + ":" + salt)
    B->>S: POST /api/auth/login { hash, salt }
    S->>S: validate body (LoginReqDTO), throttle 5/min
    S->>S: recompute proof for slots -1/0/+1 (timingSafeEqual)
    S->>S: reject if proof already used; remember it
    S-->>B: Set-Cookie: bearer=<JWT> (httpOnly, 24h) + { token }

    Note over B,S: later, any protected request
    B->>S: request with bearer cookie (or Authorization header)
    S->>S: AdminGuard: verify JWT signature + expiry
    S-->>B: response

    Note over B,S: on every SSR page load
    B->>S: GET /api/auth/check-token
    S-->>B: { isValid } + refreshed cookie when valid
```

## Environment variables involved

| Variable                           | Role                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | The only credentials; everything is derived from them |
| `NODE_ENV`                         | `production` switches the cookie to `secure`          |
