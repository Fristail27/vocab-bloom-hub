import { ErrorCodes } from 'server/core/constants/error_codes';
import { AbstractBaseApi } from '../index';

const BASE = 'http://api.test/api';

type FetchMock = jest.Mock<Promise<Partial<Response>>, [string, RequestInit]>;

const makeHeaders = (map: Record<string, string>) => ({
  get: (key: string) => map[key] ?? null,
});

describe('AbstractBaseApi', () => {
  let fetchMock: FetchMock;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_BASE_API_URL = BASE;
  });

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('request / error unions', () => {
    it('возвращает данные при успешном ответе', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });

      const res = await AbstractBaseApi.get<{ id: number }>(`${BASE}/en/1`);

      expect(res).toEqual({ id: 1 });
    });

    it('возвращает error-юнион при не-ok ответе, не бросая исключение', async () => {
      fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: 'word_doesnt_found' }) });

      const res = await AbstractBaseApi.get(`${BASE}/en/1`);

      expect(res).toEqual({ message: 'word_doesnt_found', error: true });
    });

    it('возвращает unparsed_data, если тело не парсится как JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('invalid json');
        },
      });

      const res = await AbstractBaseApi.get(`${BASE}/en/1`);

      expect(res).toEqual({ error: true, message: ErrorCodes.unparsed_data });
    });

    it('возвращает failed_fetch при сетевой ошибке', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      const res = await AbstractBaseApi.get(`${BASE}/en/1`);

      expect(res).toEqual({ error: true, message: ErrorCodes.failed_fetch });
    });

    it('сериализует body в JSON и шлёт куки', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

      await AbstractBaseApi.post(`${BASE}/en/search`, { search: 'run', limit: 100 });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ search: 'run', limit: 100 }));
      expect(init.credentials).toBe('include');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('добавляет query-параметры и пропускает undefined', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

      await AbstractBaseApi.get(`${BASE}/en/check-word/run`, {
        query: { partOfSpeech: 'verb', forPhrasal: undefined, limit: 5 },
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE}/en/check-word/run?partOfSpeech=verb&limit=5`);
    });
  });

  describe('downloadFile / extractFilename', () => {
    const makeDownloadResponse = (headers: Record<string, string>) => ({
      ok: true,
      headers: makeHeaders(headers) as unknown as Headers,
      blob: async () => new Blob(['zip-content']),
    });

    it('достаёт имя файла из filename="..."', async () => {
      fetchMock.mockResolvedValue(
        makeDownloadResponse({ 'Content-Disposition': 'attachment; filename="export.zip"' }),
      );

      const res = await AbstractBaseApi.downloadFile(`${BASE}/en/export/1`);

      expect(res).toMatchObject({ filename: 'export.zip' });
    });

    it('предпочитает и декодирует filename*=UTF-8', async () => {
      fetchMock.mockResolvedValue(
        makeDownloadResponse({
          'Content-Disposition': `attachment; filename="fallback.zip"; filename*=UTF-8''%D1%81%D0%BB%D0%BE%D0%B2%D0%B0%D1%80%D1%8C.zip`,
        }),
      );

      const res = await AbstractBaseApi.downloadFile(`${BASE}/en/export/1`);

      expect(res).toMatchObject({ filename: 'словарь.zip' });
    });

    it('оставляет filename пустым без Content-Disposition', async () => {
      fetchMock.mockResolvedValue(makeDownloadResponse({}));

      const res = await AbstractBaseApi.downloadFile(`${BASE}/en/export/1`);

      expect('error' in res).toBe(false);
      expect((res as { filename?: string }).filename).toBeUndefined();
    });

    it('читает поток по чанкам и репортит прогресс', async () => {
      const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];
      let readIndex = 0;
      fetchMock.mockResolvedValue({
        ok: true,
        headers: makeHeaders({
          'Content-Length': '5',
          'Content-Type': 'application/zip',
        }) as unknown as Headers,
        body: {
          getReader: () => ({
            read: async () =>
              readIndex < chunks.length ? { done: false, value: chunks[readIndex++] } : { done: true },
          }),
        } as unknown as NonNullable<Response['body']>,
      });

      const onProgress = jest.fn();
      const res = await AbstractBaseApi.downloadFile(`${BASE}/en/export/1`, {}, onProgress);

      expect(onProgress.mock.calls).toEqual([
        [3, 5],
        [5, 5],
      ]);
      expect('error' in res).toBe(false);
      expect((res as { blob: Blob }).blob.size).toBe(5);
    });

    it('возвращает error-юнион при не-ok ответе', async () => {
      fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: 'not_found' }) });

      const res = await AbstractBaseApi.downloadFile(`${BASE}/en/export/1`);

      expect(res).toEqual({ message: 'not_found', error: true });
    });
  });

  describe('stream', () => {
    it('возвращает reader тела ответа', async () => {
      const reader = { read: async () => ({ done: true }) };
      fetchMock.mockResolvedValue({
        ok: true,
        body: { getReader: () => reader } as unknown as NonNullable<Response['body']>,
      });

      const res = await AbstractBaseApi.stream(`${BASE}/en/dictionary/export`);

      expect(res).toBe(reader);
    });

    it('возвращает unparsed_data, если у ответа нет тела', async () => {
      fetchMock.mockResolvedValue({ ok: true, body: null });

      const res = await AbstractBaseApi.stream(`${BASE}/en/dictionary/export`);

      expect(res).toEqual({ error: true, message: ErrorCodes.unparsed_data });
    });
  });
});
