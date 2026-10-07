import { loadGraphNeighbor } from '../wordGraphClient';

const originalFetch = global.fetch;
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterAll(() => {
  global.fetch = originalFetch;
});

it('selects only the requested dataset, even when the active dataset also answers', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        { dataset: 'default', active: true, entries: [{ word: 'wrong' }] },
        { dataset: 'own', entries: [{ word: 'right' }] },
      ],
    }),
  });
  const signal = new AbortController().signal;
  expect(await loadGraphNeighbor('take off', 'own', signal)).toEqual([{ word: 'right' }]);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/v1/words/take%20off/datasets'),
    expect.objectContaining({ signal }),
  );
});

it('never falls back to another dataset when the word is absent', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ dataset: 'default', entries: [{ word: 'wrong' }] }] }),
  });
  expect(await loadGraphNeighbor('run', 'own', new AbortController().signal)).toEqual([]);
});

it('treats a missing word as empty but leaves rate limits and server failures retryable', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
  expect(await loadGraphNeighbor('run', 'own', new AbortController().signal)).toEqual([]);
  for (const status of [429, 503]) {
    fetchMock.mockResolvedValueOnce({ ok: false, status });
    await expect(loadGraphNeighbor('run', 'own', new AbortController().signal)).rejects.toThrow(String(status));
  }
});
