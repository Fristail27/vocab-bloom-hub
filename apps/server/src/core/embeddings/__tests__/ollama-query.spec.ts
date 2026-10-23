import { OllamaQueryService } from '../ollama-query.service';
import { semanticSearchConfig, semanticSearchEnabled } from '../config';

const env = {
  SEMANTIC_SEARCH_ENABLED: 'true',
  EMBEDDINGS_URL: 'http://model:11434',
  EMBEDDINGS_MODEL: 'fixture:latest',
  EMBEDDINGS_REVISION: 'a'.repeat(64),
  EMBEDDINGS_DIMENSIONS: '3',
};
const tags = (digest = env.EMBEDDINGS_REVISION) => ({ models: [{ name: 'fixture:latest', digest }] });
const vector = { model: 'fixture:latest', embeddings: [[1, 0, 0]] };

describe('query-only Ollama inference', () => {
  const fetchBefore = globalThis.fetch;
  const flagBefore = process.env.SEMANTIC_SEARCH_ENABLED;
  let fetchMock: jest.Mock;
  beforeEach(() => {
    process.env.SEMANTIC_SEARCH_ENABLED = 'true';
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });
  afterEach(() => {
    globalThis.fetch = fetchBefore;
    if (flagBefore === undefined) delete process.env.SEMANTIC_SEARCH_ENABLED;
    else process.env.SEMANTIC_SEARCH_ENABLED = flagBefore;
  });
  const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const run = () => new OllamaQueryService().embed('учёный, изучающий птиц', semanticSearchConfig(env));

  it('is off by default and performs no requests while disabled', async () => {
    expect(semanticSearchEnabled({})).toBe(false);
    process.env.SEMANTIC_SEARCH_ENABLED = 'false';
    await expect(run()).rejects.toThrow('semantic_search_disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends the exact query prompt and verifies the immutable digest before and after inference', async () => {
    fetchMock
      .mockResolvedValueOnce(response(tags()))
      .mockResolvedValueOnce(response(vector))
      .mockResolvedValueOnce(response(tags()));
    expect(await run()).toEqual([1, 0, 0]);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'http://model:11434/api/tags',
      'http://model:11434/api/embed',
      'http://model:11434/api/tags',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      model: 'fixture:latest',
      input: 'task: search result | query: учёный, изучающий птиц',
      dimensions: 3,
      truncate: false,
      keep_alive: '30m',
    });
    expect(
      fetchMock.mock.calls.every(
        (c) => c[1].signal === fetchMock.mock.calls[0][1].signal && c[1].redirect === 'error',
      ),
    ).toBe(true);
  });
  it('rejects a changed model before inference', async () => {
    fetchMock.mockResolvedValue(response(tags('b'.repeat(64))));
    await expect(run()).rejects.toThrow('semantic_model_incompatible');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects a tag changed during inference', async () => {
    fetchMock
      .mockResolvedValueOnce(response(tags()))
      .mockResolvedValueOnce(response(vector))
      .mockResolvedValueOnce(response(tags('b'.repeat(64))));
    await expect(run()).rejects.toThrow('semantic_model_incompatible');
  });
  it.each([
    { ...vector, model: 'other' },
    { ...vector, embeddings: [[1, 0]] },
    { ...vector, embeddings: [[2, 0, 0]] },
    { ...vector, embeddings: [[null, 0, 0]] },
    {
      ...vector,
      embeddings: [
        [1, 0, 0],
        [1, 0, 0],
      ],
    },
  ])('rejects incompatible inference output %#', async (result) => {
    fetchMock.mockResolvedValueOnce(response(tags())).mockResolvedValueOnce(response(result));
    await expect(run()).rejects.toThrow('semantic_model_incompatible');
  });
  it('reports timeout/offline errors without retry or lexical fallback', async () => {
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    await expect(run()).rejects.toThrow('semantic_model_unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    { EMBEDDINGS_REVISION: '' },
    { EMBEDDINGS_REVISION: 'latest' },
    { EMBEDDINGS_DIMENSIONS: '0' },
    { EMBEDDINGS_URL: 'file:///tmp/model' },
    { EMBEDDINGS_URL: 'http://secret:pass@model' },
  ])('rejects invalid config %#', (bad) => {
    expect(() => semanticSearchConfig({ ...env, ...bad })).toThrow('semantic_search_unconfigured');
  });
});
