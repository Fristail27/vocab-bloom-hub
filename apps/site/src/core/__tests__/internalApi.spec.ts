import {
  getWithOneRetry,
  INTERNAL_API_TOKEN_HEADER,
  internalApiHeaders,
  RETRY_429_MAX_WAIT_MS,
  retryAfterWithin,
} from '../internalApi';

// The site's own requests to the API (issue #483): the token that takes them
// out of the public rate budget, and the one retry a brief 429 gets

const response = (status: number, headers: Record<string, string> = {}): Response =>
  new Response(status === 204 ? null : '{}', { status, headers });

describe('internalApiHeaders', () => {
  it('carries INTERNAL_API_TOKEN when it is set, nothing otherwise', () => {
    expect(internalApiHeaders({ INTERNAL_API_TOKEN: ' secret-0123456789 ' })).toEqual({
      [INTERNAL_API_TOKEN_HEADER]: 'secret-0123456789',
    });
    expect(internalApiHeaders({})).toEqual({});
    expect(internalApiHeaders({ INTERNAL_API_TOKEN: '  ' })).toEqual({});
  });
});

describe('retryAfterWithin', () => {
  it('reads Retry-After in seconds and refuses a wait longer than a render may take', () => {
    expect(retryAfterWithin(response(429, { 'retry-after': '2' }))).toBe(2000);
    expect(retryAfterWithin(response(429, { 'retry-after': '5' }))).toBe(RETRY_429_MAX_WAIT_MS);
    expect(retryAfterWithin(response(429, { 'retry-after': '60' }))).toBeNull();
    expect(retryAfterWithin(response(429, { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }))).toBeNull();
    expect(retryAfterWithin(response(429))).toBeNull();
    expect(retryAfterWithin(response(429, { 'retry-after': '0' }))).toBeNull();
  });
});

describe('getWithOneRetry', () => {
  const scripted = (answers: Response[]) => {
    let calls = 0;
    const get = async (): Promise<Response> => {
      calls += 1;
      const next = answers.shift();
      if (!next) throw new Error('unexpected request');
      return next;
    };
    return { get, calls: () => calls };
  };
  const sleeps: number[] = [];
  const sleep = async (ms: number): Promise<void> => {
    sleeps.push(ms);
  };

  beforeEach(() => sleeps.splice(0));

  it('answers a non-429 at once', async () => {
    const { get, calls } = scripted([response(200)]);
    expect((await getWithOneRetry(get, sleep)).status).toBe(200);
    expect(calls()).toBe(1);
    expect(sleeps).toEqual([]);
  });

  it('waits Retry-After once and asks again', async () => {
    const { get, calls } = scripted([response(429, { 'retry-after': '1' }), response(200)]);
    expect((await getWithOneRetry(get, sleep)).status).toBe(200);
    expect(calls()).toBe(2);
    expect(sleeps).toEqual([1000]);
  });

  it('gives the second 429 back rather than retrying again', async () => {
    const second = response(429, { 'retry-after': '1' });
    const { get, calls } = scripted([response(429, { 'retry-after': '1' }), second]);
    expect(await getWithOneRetry(get, sleep)).toBe(second);
    expect(calls()).toBe(2);
  });

  it('does not wait for a budget that frees in a minute', async () => {
    const first = response(429, { 'retry-after': '60' });
    const { get, calls } = scripted([first]);
    expect(await getWithOneRetry(get, sleep)).toBe(first);
    expect(calls()).toBe(1);
    expect(sleeps).toEqual([]);
  });
});
