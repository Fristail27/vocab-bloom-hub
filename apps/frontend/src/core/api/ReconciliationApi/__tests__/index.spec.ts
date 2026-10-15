import { ReconciliationApi } from '../index';

it('sends structured JSON through the real base client for every review mutation', async () => {
  const previous = globalThis.fetch;
  const base = process.env.NEXT_PUBLIC_BASE_API_URL;
  process.env.NEXT_PUBLIC_BASE_API_URL = 'http://api.test/api';
  const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  globalThis.fetch = fetch;
  try {
    await ReconciliationApi.prepare('fork', 'parent', true);
    await ReconciliationApi.decide('fork', 'plan', 'word', 2, [{ path: ['definition'], choice: 'local' }]);
    await ReconciliationApi.override('fork', 'plan', 'word', 3, { present: false });
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(init.body))).toEqual([
      { source: 'parent', allow_two_way: true },
      { headword: 'word', version: 2, decisions: [{ path: ['definition'], choice: 'local' }] },
      { headword: 'word', version: 3, result: { present: false } },
    ]);
    expect(fetch.mock.calls.every(([, init]) => init.credentials === 'include')).toBe(true);
    expect(fetch.mock.calls[0][0]).toMatch(/\/reconciliation\/parent\/start$/);
    await ReconciliationApi.preparation('fork');
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/reconciliation\/preparation$/),
      expect.objectContaining({ method: 'GET', cache: 'no-store', credentials: 'include' }),
    );
  } finally {
    globalThis.fetch = previous;
    if (base === undefined) delete process.env.NEXT_PUBLIC_BASE_API_URL;
    else process.env.NEXT_PUBLIC_BASE_API_URL = base;
  }
});
