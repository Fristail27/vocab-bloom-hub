import { AuthHeaderModeE } from '../../types';
import { DEFAULT_CONFIG } from '../../constants';
import { buildHeaders, ExternalRequestError, sendExternalRequest } from '../externalRequest';

// jsdom has no Response; the code only needs ok / status / text() / headers.get()
const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    headers: { get: (name: string) => headers[name] ?? null },
  }) as unknown as Response;

describe('buildHeaders', () => {
  it('puts the key into the chosen header and parses extra header lines', () => {
    expect(buildHeaders({ ...DEFAULT_CONFIG, apiKey: 'k1' })).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer k1',
    });
    expect(
      buildHeaders({
        ...DEFAULT_CONFIG,
        apiKey: ' k2 ',
        authHeaderMode: AuthHeaderModeE.x_api_key,
        extraHeaders: 'anthropic-version: 2023-06-01\n\nbroken line\nX-Empty:',
      }),
    ).toEqual({
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'X-Empty': '',
      'x-api-key': 'k2',
    });
    expect(
      buildHeaders({
        ...DEFAULT_CONFIG,
        apiKey: 'k3',
        authHeaderMode: AuthHeaderModeE.custom,
        customAuthHeaderName: 'Api-Token',
      }),
    ).toMatchObject({ 'Api-Token': 'k3' });
  });

  it('sends no auth header without a key', () => {
    expect(buildHeaders({ ...DEFAULT_CONFIG, apiKey: '' })).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('sendExternalRequest', () => {
  const base = { url: 'https://api.example.com/v1', headers: { A: 'b' }, body: '{"x":1}' };

  it('POSTs the body with the headers and returns the parsed JSON', async () => {
    const fetchFn = jest.fn(async () => jsonResponse(200, { ok: true }));

    await expect(sendExternalRequest({ ...base, maxRetries: 0, fetchFn })).resolves.toEqual({
      status: 200,
      json: { ok: true },
      text: '{"ok":true}',
    });
    expect(fetchFn).toHaveBeenCalledWith(
      base.url,
      expect.objectContaining({ method: 'POST', headers: base.headers, body: base.body }),
    );
  });

  it('keeps the raw text when the successful response is not JSON', async () => {
    const fetchFn = jest.fn(async () => jsonResponse(200, 'plain'));
    await expect(sendExternalRequest({ ...base, maxRetries: 0, fetchFn })).resolves.toEqual({
      status: 200,
      json: undefined,
      text: 'plain',
    });
  });

  it('retries 429 and 5xx honouring Retry-After, then succeeds', async () => {
    jest.useFakeTimers();
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: 'slow down' }, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(jsonResponse(503, 'busy'))
      .mockResolvedValueOnce(jsonResponse(200, { ok: 1 }));

    const promise = sendExternalRequest({ ...base, maxRetries: 3, fetchFn });
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(promise).resolves.toMatchObject({ status: 200, json: { ok: 1 } });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('gives up after maxRetries with an http error carrying the status', async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn(async () => jsonResponse(500, 'boom'));

    const promise = sendExternalRequest({ ...base, maxRetries: 1, fetchFn });
    const assertion = expect(promise).rejects.toMatchObject({ kind: 'http', status: 500 });
    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(fetchFn).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not retry other 4xx', async () => {
    const fetchFn = jest.fn(async () => jsonResponse(401, { error: 'bad key' }));
    await expect(sendExternalRequest({ ...base, maxRetries: 3, fetchFn })).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      message: expect.stringContaining('HTTP 401'),
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('turns a fetch TypeError into a network error mentioning CORS', async () => {
    const fetchFn = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await sendExternalRequest({ ...base, maxRetries: 0, fetchFn }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExternalRequestError);
    expect(err).toMatchObject({ kind: 'network', message: expect.stringContaining('CORS') });
  });

  it('reports an aborted signal as aborted without calling fetch again', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = jest.fn();
    await expect(
      sendExternalRequest({ ...base, maxRetries: 3, signal: controller.signal, fetchFn }),
    ).rejects.toMatchObject({
      kind: 'aborted',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
