/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { apiTarget, forwardToApi } from '../apiProxy';

describe('/api/* forwarded to the server (issue #316)', () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
  const saved = { internal: process.env.API_INTERNAL_URL, port: process.env.SERVER_PORT };

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.API_INTERNAL_URL = 'http://server:3010/api/';
  });

  afterEach(() => {
    if (saved.internal === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = saved.internal;
    if (saved.port === undefined) delete process.env.SERVER_PORT;
    else process.env.SERVER_PORT = saved.port;
  });

  it('targets API_INTERNAL_URL, or the server on this host', () => {
    expect(apiTarget({ API_INTERNAL_URL: 'http://server:3010/api/' })).toBe('http://server:3010/api');
    expect(apiTarget({})).toBe('http://127.0.0.1:3010/api');
    expect(apiTarget({ SERVER_PORT: '3110' })).toBe('http://127.0.0.1:3110/api');
  });

  it('relays the request with its query, cookies and body, and returns status, cookies and body', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"token":"t"}', {
        status: 201,
        headers: [
          ['content-type', 'application/json; charset=utf-8'],
          ['set-cookie', 'bearer=t; Path=/; HttpOnly'],
          ['set-cookie', 'other=1; Path=/'],
          ['content-encoding', 'gzip'],
        ],
      }),
    );
    const req = new NextRequest('http://localhost:3000/api/auth/login?x=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'bearer=old', host: 'localhost:3000' },
      body: '{"hash":"h","salt":"s"}',
    });

    const res = await forwardToApi(req, ['auth', 'login']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://server:3010/api/auth/login?x=1');
    expect(init.method).toBe('POST');
    const sent = init.headers as Headers;
    expect(sent.get('cookie')).toBe('bearer=old');
    expect(sent.get('x-forwarded-host')).toBe('localhost:3000');
    expect(sent.get('x-forwarded-proto')).toBe('http');
    expect(sent.get('host')).toBeNull();
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('{"token":"t"}');
    expect(res.headers.getSetCookie()).toEqual(['bearer=t; Path=/; HttpOnly', 'other=1; Path=/']);
    expect(res.headers.get('content-encoding')).toBeNull();
  });

  it('marks the progress streams no-transform so they are not buffered by compression', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"percent":1}\n', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'x-accel-buffering': 'no' },
      }),
    );
    const req = new NextRequest('http://localhost:3000/api/en/dictionary/export');
    const res = await forwardToApi(req, ['en', 'dictionary', 'export']);
    expect(res.headers.get('cache-control')).toBe('no-store, no-transform');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
});
