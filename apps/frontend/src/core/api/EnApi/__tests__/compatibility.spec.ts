import { EnApi } from '../index';

describe('compatibility playground requests', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('omits credentials for wildcard CORS and keeps array responses intact', async () => {
    const data = [{ word: 'fixture', meanings: [], phonetics: [], sourceUrls: [] }];
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => data });
    globalThis.fetch = fetchMock;
    expect(await EnApi.publicGet('/compat/dictionaryapi/v2/entries/en/fixture')).toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/compat/dictionaryapi/v2/entries/en/fixture'),
      expect.objectContaining({ credentials: 'omit' }),
    );
    await EnApi.publicGet('/v1/words/fixture');
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include');
  });

  it('keeps freedictionaryapi objects and translates plain-text failures to the UI error union', async () => {
    const data = { word: 'fixture', entries: [], source: {} };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => data })
      .mockResolvedValueOnce({ ok: false, text: async () => 'Invalid boolean' });
    globalThis.fetch = fetchMock;
    const path = '/compat/freedictionaryapi/v1/entries/en/fixture';
    expect(await EnApi.publicGet(path)).toEqual(data);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('plainTextErrors');
    expect(await EnApi.publicGet(path, { pretty: '1' })).toEqual({ error: true, message: 'Invalid boolean' });
  });
});
