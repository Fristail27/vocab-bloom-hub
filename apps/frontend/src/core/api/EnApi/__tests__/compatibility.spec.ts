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
});
